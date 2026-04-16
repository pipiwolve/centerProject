from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import requests

from .config import AppConfig
from .types import SyncResult
from .utils import md5_file, read_json, write_json


class BailianSyncClient:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self._models_mod: Any | None = None

    def sync_bundles(self, docs_bundle: Path, faq_bundle: Path) -> SyncResult:
        if not self.config.enable_cloud_sync:
            detail = "Cloud sync disabled; local assets were generated successfully."
            result = SyncResult(status="skipped", detail=detail)
            write_json(self.config.sync_report_path, result.to_dict())
            return result

        missing = [
            name
            for name, value in {
                "ALIBABA_CLOUD_ACCESS_KEY_ID": self.config.cloud_access_key_id,
                "ALIBABA_CLOUD_ACCESS_KEY_SECRET": self.config.cloud_access_key_secret,
                "DASHSCOPE_WORKSPACE_ID": self.config.workspace_id,
            }.items()
            if not value
        ]
        if missing:
            detail = f"Cloud sync requested but missing credentials: {', '.join(missing)}."
            result = SyncResult(status="blocked", detail=detail)
            write_json(self.config.sync_report_path, result.to_dict())
            return result

        try:
            uploaded_files = [
                self._sync_single_bundle(bundle=docs_bundle, kb_type="docs"),
                self._sync_single_bundle(bundle=faq_bundle, kb_type="faq"),
            ]
            result = SyncResult(
                status="completed",
                detail="Cloud knowledge bundles synchronized to Bailian.",
                docs_kb_id=uploaded_files[0]["index_id"],
                faq_kb_id=uploaded_files[1]["index_id"],
                uploaded_files=uploaded_files,
            )
        except Exception as exc:  # pragma: no cover - depends on cloud credentials
            result = SyncResult(
                status="failed",
                detail=f"Bailian synchronization failed: {exc}",
            )

        write_json(self.config.sync_report_path, result.to_dict())
        return result

    def _sync_single_bundle(self, bundle: Path, kb_type: str) -> dict[str, Any]:
        client, models_mod, openapi_mod, util_mod = self._create_client()
        previous_report = read_json(self.config.sync_report_path, {})
        previous_uploads = {
            item.get("kind"): item
            for item in previous_report.get("uploaded_files", [])
            if isinstance(item, dict)
        }
        target_index_id = self.config.docs_kb_id if kb_type == "docs" else self.config.faq_kb_id
        previous_upload = previous_uploads.get(kb_type, {})
        category_id = self.config.category_id

        lease_request = models_mod.ApplyFileUploadLeaseRequest(
            file_name=bundle.name,
            md_5=md5_file(bundle),
            size_in_bytes=bundle.stat().st_size,
        )
        runtime = util_mod.RuntimeOptions()
        lease_response = client.apply_file_upload_lease_with_options(
            category_id,
            self.config.workspace_id,
            lease_request,
            {},
            runtime,
        )
        lease_id = lease_response.body.data.file_upload_lease_id
        upload_url = lease_response.body.data.param.url
        upload_headers = dict(lease_response.body.data.param.headers)
        self._upload_file(upload_url, upload_headers, bundle)

        add_file_request = models_mod.AddFileRequest(
            lease_id=lease_id,
            parser=self.config.parser_name,
            category_id=category_id,
        )
        add_response = client.add_file_with_options(
            self.config.workspace_id,
            add_file_request,
            {},
            runtime,
        )
        file_id = add_response.body.data.file_id
        self._wait_for_file_parse(client, file_id, runtime)

        if target_index_id:
            index_id = target_index_id
            add_job_request = models_mod.SubmitIndexAddDocumentsJobRequest(
                index_id=index_id,
                document_ids=[file_id],
                source_type=self.config.source_type,
            )
            add_job = client.submit_index_add_documents_job_with_options(
                self.config.workspace_id,
                add_job_request,
                {},
                runtime,
            )
            job_id = add_job.body.data.id
            self._wait_for_job(client, index_id=index_id, job_id=job_id, runtime=runtime)
            if previous_upload.get("file_id"):
                delete_request = models_mod.DeleteIndexDocumentRequest(
                    index_id=index_id,
                    document_ids=[previous_upload["file_id"]],
                )
                client.delete_index_document_with_options(
                    self.config.workspace_id,
                    delete_request,
                    {},
                    runtime,
                )
        else:
            index_name = f"LeatherCare-{kb_type}-{bundle.stem}"[:20]
            create_request = models_mod.CreateIndexRequest(
                structure_type="unstructured",
                name=index_name,
                source_type=self.config.source_type,
                sink_type=self.config.sink_type,
                document_ids=[file_id],
            )
            create_response = client.create_index_with_options(
                self.config.workspace_id,
                create_request,
                {},
                runtime,
            )
            index_id = create_response.body.data.id
            submit_request = models_mod.SubmitIndexJobRequest(index_id=index_id)
            submit_response = client.submit_index_job_with_options(
                self.config.workspace_id,
                submit_request,
                {},
                runtime,
            )
            self._wait_for_job(
                client,
                index_id=index_id,
                job_id=submit_response.body.data.id,
                runtime=runtime,
            )

        return {
            "kind": kb_type,
            "bundle_path": str(bundle),
            "file_id": file_id,
            "index_id": index_id,
            "updated_at": int(time.time()),
        }

    def _create_client(self) -> tuple[Any, Any, Any, Any]:
        from alibabacloud_bailian20231229 import models as bailian_models
        from alibabacloud_bailian20231229.client import Client as BailianClient
        from alibabacloud_tea_openapi import models as open_api_models
        from alibabacloud_tea_util import models as util_models

        self._models_mod = bailian_models
        config = open_api_models.Config(
            access_key_id=self.config.cloud_access_key_id,
            access_key_secret=self.config.cloud_access_key_secret,
        )
        config.endpoint = self.config.bailian_endpoint
        return BailianClient(config), bailian_models, open_api_models, util_models

    def _upload_file(self, upload_url: str, upload_headers: dict[str, str], path: Path) -> None:
        headers = {
            "X-bailian-extra": upload_headers.get("X-bailian-extra", ""),
            "Content-Type": upload_headers.get("Content-Type", ""),
        }
        with path.open("rb") as file_handle:
            response = requests.put(upload_url, data=file_handle, headers=headers, timeout=120)
        response.raise_for_status()

    def _wait_for_file_parse(self, client: Any, file_id: str, runtime: Any) -> None:
        while True:
            response = client.describe_file_with_options(
                self.config.workspace_id,
                file_id,
                {},
                runtime,
            )
            status = getattr(response.body.data, "status", "")
            if status == "PARSE_SUCCESS":
                return
            if status not in {"INIT", "PARSING"}:
                raise RuntimeError(f"Unexpected Bailian file parse status: {status}")
            time.sleep(3)

    def _wait_for_job(self, client: Any, index_id: str, job_id: str, runtime: Any) -> None:
        if self._models_mod is None:
            raise RuntimeError("Bailian models are not initialized.")
        while True:
            status_request = self._models_mod.GetIndexJobStatusRequest(index_id=index_id, job_id=job_id)
            request = client.get_index_job_status_with_options(
                self.config.workspace_id,
                status_request,
                {},
                runtime,
            )
            status = getattr(request.body.data, "status", "")
            if status == "COMPLETED":
                return
            if status in {"FAILED", "CANCELED"}:
                raise RuntimeError(f"Bailian index job failed with status {status}")
            time.sleep(5)
