import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileInput, Button, Label } from "flowbite-react";
import { downloadTestFile, uploadTestFile } from "../../lib/rustfsTestApi";

// Throwaway page: only exists to manually verify the RustFS pipeline works
// end-to-end (browser -> backend -> RustFS -> backend -> browser). Not linked
// from any nav - reachable only by typing the URL. Delete once the real
// avatar/attachment feature is built on top of StorageService directly.
export const Route = createFileRoute("/_authenticated/rustfs-test")({
  component: RustfsTestPage,
});

function RustfsTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key) {
      setImageUrl(null);
      return;
    }
    let active = true;
    let objectUrl: string | undefined;
    void downloadTestFile(key)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Download failed");
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [key]);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await uploadTestFile(file);
      setKey(result.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-brand-700 text-xl font-semibold">RustFS test</h1>

      <div>
        <Label htmlFor="rustfs-test-file">Pick a file (stay under 1MB)</Label>
        <FileInput
          id="rustfs-test-file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Button onClick={handleUpload} disabled={!file || loading}>
        {loading ? "Uploading…" : "Upload"}
      </Button>

      {error && <p className="text-red-600">{error}</p>}

      {key && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Uploaded key: {key}</p>
          {imageUrl && (
            <img
              src={imageUrl}
              alt="uploaded test file"
              className="max-w-full rounded border"
            />
          )}
        </div>
      )}
    </div>
  );
}
