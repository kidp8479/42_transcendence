import { ApiError, bearerFetch, readErrorMessage } from "./apiClient";

export interface UploadTestFileResult {
  bucket: string;
  key: string;
  size: number;
}

// Can't go through apiClient() here: it always JSON-encodes the body and
// force-sets Content-Type, which breaks multipart/form-data uploads (the
// browser needs to set its own boundary in Content-Type).
export async function uploadTestFile(
  file: File
): Promise<UploadTestFileResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await bearerFetch("/api/rustfs-test/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return response.json();
}

export async function downloadTestFile(key: string): Promise<Blob> {
  const response = await bearerFetch(
    `/api/rustfs-test/${encodeURIComponent(key)}`
  );
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return response.blob();
}
