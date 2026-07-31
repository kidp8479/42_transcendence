import { getSession } from "./auth";
import { ApiError, getCsrfToken, readErrorMessage } from "./apiClient";

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
  const token = getCsrfToken() ?? (await getSession())?.csrfToken;
  if (!token) {
    throw new Error("An active session is required");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/rustfs-test/upload", {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": token },
    body: formData,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  return response.json();
}

export function testFileDownloadUrl(key: string): string {
  return `/api/rustfs-test/${encodeURIComponent(key)}`;
}
