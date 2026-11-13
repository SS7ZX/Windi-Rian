import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { createGuestsBulk, type BulkGuestResult } from "./api";
import { guestImportTemplate, parseGuestImport } from "./guest-import";
import type { Guest, GuestDraft } from "./types";

type Props = {
  guests: Guest[];
  onClose: () => void;
  onImported: (guests: Guest[], results: BulkGuestResult[]) => void;
};

type ImportResult = { success: boolean; message: string };

function downloadTemplate() {
  const blob = new Blob([guestImportTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "template-impor-tamu.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function GuestImportModal({ guests, onClose, onImported }: Props) {
  const [mode, setMode] = useState<"csv" | "paste">("csv");
  const [text, setText] = useState("");
  const [selection, setSelection] = useState<Record<number, boolean>>({});
  const [results, setResults] = useState<Record<number, ImportResult>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => parseGuestImport(text, guests), [text, guests]);
  const selectableRows = preview.rows.filter(row => row.draft && !row.error);
  const selectedRows = selectableRows.filter(row => !results[row.rowNumber]?.success
    && (selection[row.rowNumber] ?? row.selected));
  const duplicateCount = preview.rows.filter(row => row.duplicate).length;
  const invalidCount = preview.rows.filter(row => row.error).length;

  const changeText = (value: string) => {
    setText(value);
    setSelection({});
    setResults({});
    setError("");
  };

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("Ukuran file maksimal 2 MB.");
      return;
    }
    try {
      changeText(await file.text());
      setMode("csv");
    } catch {
      setError("File tidak dapat dibaca. Coba simpan ulang sebagai CSV UTF-8.");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (preview.error || !selectedRows.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const drafts = selectedRows.map(row => row.draft as GuestDraft);
      const response = await createGuestsBulk(drafts);
      const nextResults: Record<number, ImportResult> = {};
      const added: Guest[] = [];
      for (const result of response) {
        const row = selectedRows[result.index];
        if (!row) continue;
        if (result.guest) {
          added.push(result.guest);
          nextResults[row.rowNumber] = { success: true, message: "Berhasil ditambahkan." };
        } else {
          nextResults[row.rowNumber] = { success: false, message: result.error || "Baris gagal disimpan." };
        }
      }
      setResults(current => ({ ...current, ...nextResults }));
      setSelection(current => ({
        ...current,
        ...Object.fromEntries(selectedRows.filter(row => nextResults[row.rowNumber]?.success)
          .map(row => [row.rowNumber, false])),
      }));
      onImported(added, response);

      const succeededCount = added.length;
      const failedCount = selectedRows.length - succeededCount;
      if (succeededCount && !failedCount) onClose();
      else if (failedCount) setError(`${succeededCount} tamu berhasil ditambahkan; ${failedCount} baris gagal. Periksa hasil per baris di bawah.`);
    } catch (importError) {
      setError(importError instanceof Error
        ? `${importError.message} Data tetap ditampilkan agar bisa diperiksa sebelum mencoba lagi.`
        : "Impor gagal. Data tetap ditampilkan agar bisa diperiksa sebelum mencoba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="admin-modal admin-import-modal" role="dialog" aria-modal="true" aria-labelledby="guest-import-title">
        <div className="admin-modal-heading">
          <div><p className="admin-eyebrow">KELOLA BANYAK TAMU</p><h2 id="guest-import-title">Impor tamu massal</h2></div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Tutup impor" disabled={busy}>×</button>
        </div>
        <p className="admin-import-description">Unggah CSV atau tempel data dari spreadsheet. Data baru akan disimpan hanya setelah kamu meninjau dan mengonfirmasi pratinjau.</p>
        <div className="admin-import-tools">
          <div className="admin-import-tabs" role="tablist" aria-label="Metode input tamu">
            <button type="button" role="tab" aria-selected={mode === "csv"} className={mode === "csv" ? "is-active" : ""} onClick={() => setMode("csv")}>Unggah CSV</button>
            <button type="button" role="tab" aria-selected={mode === "paste"} className={mode === "paste" ? "is-active" : ""} onClick={() => setMode("paste")}>Tempel baris</button>
          </div>
          <button type="button" className="admin-button admin-button-light" onClick={downloadTemplate}>Unduh template CSV</button>
        </div>
        {mode === "csv" ? (
          <label className="admin-import-file">
            Pilih file CSV (maksimal 2 MB)
            <input type="file" accept=".csv,text/csv" onChange={event => void readFile(event)} />
          </label>
        ) : (
          <label className="admin-import-paste">
            Tempel data CSV atau baris dari spreadsheet
            <textarea value={text} onChange={event => changeText(event.target.value)} rows={7}
              placeholder={"Nama\tWhatsApp\tRelasi\tKategori\tCatatan Internal\nIbu Sari\t081234567890\tKeluarga\tKeluarga\t"} />
          </label>
        )}
        <p className="admin-import-hint">Kolom wajib: Nama. Kolom opsional: WhatsApp, Relasi, Kategori, Catatan Internal. Kategori kosong otomatis menjadi Keluarga. Batas 500 baris per impor.</p>

        {text && (
          <section className="admin-import-preview" aria-label="Pratinjau impor">
            <div className="admin-import-summary">
              <strong>Pratinjau</strong>
              <span>{preview.rows.length} baris</span>
              <span>{selectedRows.length} dipilih</span>
              {duplicateCount > 0 && <span className="is-warning">{duplicateCount} kemungkinan duplikat</span>}
              {invalidCount > 0 && <span className="is-error">{invalidCount} perlu diperbaiki</span>}
            </div>
            {preview.error && <p className="admin-form-error" role="alert">{preview.error}</p>}
            {!preview.error && <div className="admin-import-table-wrap">
              <table className="admin-import-table">
                <thead><tr><th>Impor</th><th>Baris</th><th>Nama</th><th>WhatsApp</th><th>Kategori</th><th>Status</th></tr></thead>
                <tbody>{preview.rows.map(row => {
                  const result = results[row.rowNumber];
                  const checked = selection[row.rowNumber] ?? row.selected;
                  return <tr key={row.rowNumber} className={row.error ? "has-error" : row.duplicate ? "has-duplicate" : ""}>
                    <td><input type="checkbox" aria-label={`Pilih baris ${row.rowNumber}${row.duplicate ? " sebagai duplikat" : ""}`}
                      disabled={Boolean(row.error) || Boolean(result?.success) || busy}
                      checked={checked} onChange={event => setSelection(current => ({ ...current, [row.rowNumber]: event.target.checked }))} /></td>
                    <td>{row.rowNumber}</td>
                    <td>{row.draft?.name || "—"}</td>
                    <td>{row.draft?.phone || "—"}</td>
                    <td>{row.draft?.category || "—"}</td>
                    <td>
                      {result ? <span className={result.success ? "admin-import-success" : "admin-import-error"}>{result.message}</span>
                        : row.error ? <span className="admin-import-error">{row.error}</span>
                          : row.duplicate ? <span className="admin-import-duplicate">{row.duplicate}</span>
                            : <span className="admin-muted">Siap diimpor</span>}
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>}
          </section>
        )}
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          <div className="admin-modal-actions">
            <button type="button" className="admin-button admin-button-light" onClick={onClose} disabled={busy}>Tutup</button>
            <button type="submit" className="admin-button admin-button-primary" disabled={busy || Boolean(preview.error) || !selectedRows.length}>
              {busy ? "Mengimpor..." : `Impor ${selectedRows.length} tamu`}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
