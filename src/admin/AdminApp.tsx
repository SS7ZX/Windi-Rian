import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabaseConfigured } from "./supabase";
import { createGuest, deleteGuest, getAdminToken, listGuests, loginAdmin, logoutAdmin, markWhatsAppOpened, updateGuest, type BulkGuestResult } from "./api";
import { emptyGuestDraft, guestCategories, type Guest, type GuestDraft, type GuestUpdateDraft, type RsvpStatus } from "./types";
import { guestAnalytics, guestsCsv, invitationMessage, inviteUrl, normalizeWhatsAppNumber, validateGuestDraft } from "./guest-utils";
import GuestImportModal from "./GuestImportModal";
import "./admin.css";

type ModalState =
  | { type: "form"; guest: Guest | null }
  | { type: "delete"; guest: Guest }
  | { type: "whatsapp"; guest: Guest }
  | { type: "import" }
  | null;
type Toast = { type: "success" | "error"; message: string };

const rsvpLabels: Record<RsvpStatus, string> = {
  pending: "Belum konfirmasi",
  attending: "Hadir",
  declined: "Tidak hadir",
};

function Icon({ name }: { name: "search" | "plus" | "download" | "upload" | "edit" | "trash" | "copy" | "open" | "message" | "logout" | "users" | "check" | "clock" | "heart" }) {
  const paths: Record<typeof name, string> = {
    search: "M21 21l-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z",
    plus: "M12 5v14M5 12h14",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3",
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5-5 5 5m-5-5v12",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z",
    trash: "M3 6h18m-2 0-.9 14H5.9L5 6m3 0V4h8v2m-7 4v6m4-6v6",
    copy: "M8 8V4h12v12h-4M4 8h12v12H4z",
    open: "M14 3h7v7m-1-6-9 9m-2-7H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
    message: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
    users: "M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-3a4 4 0 0 1 0 8m2 2h4v-2a4 4 0 0 0-3-3.9",
    check: "m5 12 4 4L19 6",
    clock: "M12 8v4l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z",
  };
  return <svg className="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

function GuestForm({ guest, onClose, onSave }: {
  guest: Guest | null;
  onClose: () => void;
  onSave: (draft: GuestDraft | GuestUpdateDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<GuestDraft | GuestUpdateDraft>(() => guest ? {
    name: guest.name,
    phone: guest.phone ?? "",
    relation: guest.relation ?? "",
    category: guest.category,
    internal_note: guest.internal_note ?? "",
    rsvp_status: guest.rsvp_status,
    party_size: guest.party_size,
    wishes: guest.wishes ?? "",
  } : emptyGuestDraft());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateGuestDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const cleanDraft = {
        ...draft,
        name: draft.name.trim().replace(/\s+/g, " "),
        phone: draft.phone?.trim() || null,
        relation: draft.relation?.trim() || null,
        internal_note: draft.internal_note?.trim() || null,
        ...("wishes" in draft ? { wishes: draft.wishes?.trim() || null } : {}),
      };
      await onSave(cleanDraft);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Tamu tidak dapat disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="guest-form-title">
        <div className="admin-modal-heading">
          <div><p className="admin-eyebrow">DATA UNDANGAN</p><h2 id="guest-form-title">{guest ? "Edit tamu" : "Tambah tamu"}</h2></div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Tutup form" disabled={saving}>×</button>
        </div>
        {guest && <p className="admin-slug-note">Tautan personal tetap sama saat nama tamu diedit.</p>}
        <form className="admin-form" onSubmit={submit}>
          <label>Nama tamu <span>*</span><input autoFocus required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Contoh: Bapak Ahmad" /></label>
          <label>Nomor WhatsApp <small>Opsional, diperlukan untuk berbagi lewat WhatsApp</small><input type="tel" inputMode="tel" maxLength={24} value={draft.phone ?? ""} onChange={event => setDraft({ ...draft, phone: event.target.value })} placeholder="Contoh: 081234567890" /></label>
          <div className="admin-form-grid">
            <label>Hubungan / relasi<input maxLength={120} value={draft.relation ?? ""} onChange={event => setDraft({ ...draft, relation: event.target.value })} placeholder="Contoh: Keluarga" /></label>
            <label>Kategori tamu<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value as GuestDraft["category"] })}>{guestCategories.map(category => <option key={category}>{category}</option>)}</select></label>
          </div>
          <label>Catatan internal <small>Hanya terlihat di halaman admin</small><textarea maxLength={1000} rows={3} value={draft.internal_note ?? ""} onChange={event => setDraft({ ...draft, internal_note: event.target.value })} placeholder="Catatan untuk panitia (opsional)" /></label>
          {guest && "rsvp_status" in draft && <fieldset className="admin-rsvp-edit">
            <legend>RSVP dan ucapan</legend>
            <div className="admin-form-grid">
              <label>Status RSVP<select value={draft.rsvp_status} onChange={event => setDraft({ ...draft, rsvp_status: event.target.value as RsvpStatus })}><option value="pending">Belum konfirmasi</option><option value="attending">Hadir</option><option value="declined">Tidak hadir</option></select></label>
              <label>Jumlah hadir<input type="number" min={1} max={6} disabled={draft.rsvp_status !== "attending"} value={draft.party_size} onChange={event => setDraft({ ...draft, party_size: Number(event.target.value) })} /></label>
            </div>
            <label>Ucapan tamu<textarea maxLength={2000} rows={3} value={draft.wishes ?? ""} onChange={event => setDraft({ ...draft, wishes: event.target.value })} placeholder="Ucapan dan doa (opsional)" /></label>
          </fieldset>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
          <div className="admin-modal-actions"><button type="button" className="admin-button admin-button-light" onClick={onClose} disabled={saving}>Batal</button><button type="submit" className="admin-button admin-button-primary" disabled={saving}>{saving ? "Menyimpan..." : guest ? "Simpan perubahan" : "Tambah tamu"}</button></div>
        </form>
      </section>
    </div>
  );
}

function AdminLogin({ onLogin, busy, error }: { onLogin: (username: string, password: string) => Promise<void>; busy: boolean; error: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    try { await onLogin(username.trim(), password); } catch (loginError) {
      setFormError(loginError instanceof Error ? loginError.message : "Tidak dapat masuk.");
    }
  };
  return (
    <main className="admin-login-wrap">
      <section className="admin-login-card">
        <div className="admin-login-mark"><Icon name="users" /></div>
        <p className="admin-eyebrow">UNDANGAN RIAN &amp; WINDI</p>
        <h1>Masuk ke Admin</h1>
        <p className="admin-muted">Kelola tamu dan tautan undangan personal.</p>
        <form className="admin-form" onSubmit={submit}>
          <label>Username admin<input type="text" autoComplete="username" required maxLength={64} value={username} onChange={event => setUsername(event.target.value)} placeholder="admin" /></label>
          <label>Kata sandi<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Kata sandi" /></label>
          {(formError || error) && <p className="admin-form-error" role="alert">{formError || error}</p>}
          <button className="admin-button admin-button-primary admin-login-submit" type="submit" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
        </form>
      </section>
    </main>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState<string | null>(() => getAdminToken());
  const [signingIn, setSigningIn] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Semua kategori");
  const [rsvpFilter, setRsvpFilter] = useState("Semua status");
  const [modal, setModal] = useState<ModalState>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    document.body.classList.add("admin-body");
    return () => document.body.classList.remove("admin-body");
  }, []);

  useEffect(() => {
    const expireSession = () => {
      setSession(null);
      setGuests([]);
      setLoadError("Sesi admin berakhir. Silakan masuk kembali.");
    };
    window.addEventListener("admin-session-expired", expireSession);
    return () => window.removeEventListener("admin-session-expired", expireSession);
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return null;
      setLoading(true);
      setLoadError("");
      return listGuests();
    }).then(data => { if (active && data) setGuests(data); })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : "Daftar tamu gagal dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, refreshKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredGuests = useMemo(() => guests.filter(guest => {
    const search = query.trim().toLowerCase();
    const matchesSearch = !search || [guest.name, guest.phone, guest.relation, guest.category, guest.wishes]
      .some(value => value?.toLowerCase().includes(search));
    const matchesCategory = categoryFilter === "Semua kategori" || guest.category === categoryFilter;
    const matchesRsvp = rsvpFilter === "Semua status" || guest.rsvp_status === rsvpFilter;
    return matchesSearch && matchesCategory && matchesRsvp;
  }), [guests, query, categoryFilter, rsvpFilter]);

  const stats = useMemo(() => ({
    ...guestAnalytics(guests),
  }), [guests]);

  const signIn = async (username: string, password: string) => {
    setSigningIn(true);
    try {
      setSession(await loginAdmin(username, password));
    } finally {
      setSigningIn(false);
    }
  };

  const signOut = () => {
    logoutAdmin();
    setSession(null);
    setGuests([]);
  };

  const saveGuest = async (draft: GuestDraft | GuestUpdateDraft) => {
    const editing = modal?.type === "form" ? modal.guest : null;
    if (editing) {
      if (!("rsvp_status" in draft)) throw new Error("Data RSVP belum lengkap.");
      const updated = await updateGuest(editing.id, draft);
      setGuests(current => current.map(guest => guest.id === updated.id ? updated : guest));
      setToast({ type: "success", message: "Perubahan tamu berhasil disimpan." });
    } else {
      const created = await createGuest(draft);
      setGuests(current => [created, ...current]);
      setToast({ type: "success", message: "Tamu berhasil ditambahkan." });
    }
    setModal(null);
  };

  const importedGuests = (created: Guest[], results: BulkGuestResult[]) => {
    if (created.length) {
      setGuests(current => [...created.slice().reverse(), ...current]);
    }
    const failed = results.length - created.length;
    if (failed === 0) {
      setToast({ type: "success", message: `${created.length} tamu berhasil ditambahkan.` });
    } else {
      setToast({
        type: created.length ? "success" : "error",
        message: created.length
          ? `${created.length} tamu ditambahkan. Periksa ${failed} baris yang gagal pada pratinjau impor.`
          : `Impor gagal untuk ${failed} baris. Periksa hasil per baris pada pratinjau.`,
      });
    }
  };

  const confirmDelete = async () => {
    if (modal?.type !== "delete") return;
    setDeleting(true);
    try {
      await deleteGuest(modal.guest.id);
      setGuests(current => current.filter(guest => guest.id !== modal.guest.id));
      setModal(null);
      setToast({ type: "success", message: "Tamu dan data RSVP/ucapannya berhasil dihapus." });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Tamu gagal dihapus." });
    } finally {
      setDeleting(false);
    }
  };

  const copyLink = async (guest: Guest) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(guest));
      setToast({ type: "success", message: `Tautan undangan ${guest.name} berhasil disalin.` });
    } catch {
      setToast({ type: "error", message: "Tautan gagal disalin. Periksa izin clipboard browser." });
    }
  };

  const shareManually = async (guest: Guest, url: string) => {
    const whatsAppWindow = window.open(url, "_blank");
    if (!whatsAppWindow) {
      setToast({ type: "error", message: "WhatsApp tidak dapat dibuka. Izinkan pop-up lalu coba lagi." });
      return;
    }
    whatsAppWindow.opener = null;
    try {
      const result = await markWhatsAppOpened(guest.id);
      setGuests(current => current.map(item => item.id === result.id ? { ...item, ...result } : item));
      setToast({ type: "success", message: "WhatsApp dibuka. Pesan belum terkirim—tekan Kirim di WhatsApp." });
    } catch (error) {
      setToast({ type: "error", message: `WhatsApp sudah dibuka, tetapi status berbagi gagal disimpan: ${error instanceof Error ? error.message : "kesalahan server"}` });
    }
  };

  const exportCsv = () => {
    const blob = new Blob([guestsCsv(filteredGuests)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "daftar-tamu.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setToast({ type: "success", message: `${filteredGuests.length} tamu diekspor ke CSV.` });
  };

  if (!supabaseConfigured) return (
    <main className="admin-config-screen"><section><p className="admin-eyebrow">KONFIGURASI DIPERLUKAN</p><h1>Supabase belum terhubung</h1><p>Isi <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> sesuai petunjuk di README, lalu muat ulang aplikasi.</p></section></main>
  );
  if (!session) return <AdminLogin onLogin={signIn} busy={signingIn} error="" />;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <a className="admin-brand" href="/admin"><span className="admin-brand-mark"><Icon name="users" /></span><span><b>Undangan Rian &amp; Windi</b><small>Panel admin</small></span></a>
        <div className="admin-account"><span className="admin-avatar">A</span><span className="admin-account-email">Admin</span><button className="admin-button admin-button-light admin-logout" onClick={signOut}><Icon name="logout" />Keluar</button></div>
      </header>

      <div className="admin-content">
        <section className="admin-page-heading">
          <div><p className="admin-eyebrow">DASHBOARD UNDANGAN</p><h1>Daftar Tamu</h1><p className="admin-muted">Kelola undangan dan pantau konfirmasi kehadiran.</p></div>
          <div className="admin-heading-actions">
            <button className="admin-button admin-button-light" onClick={() => setModal({ type: "import" })}><Icon name="upload" />Impor tamu</button>
            <button className="admin-button admin-button-primary" onClick={() => setModal({ type: "form", guest: null })}><Icon name="plus" />Tambah tamu</button>
          </div>
        </section>

        <section className="admin-analytics" aria-labelledby="admin-analytics-title">
          <div className="admin-analytics-heading">
            <div><p className="admin-eyebrow">PANTAU KEHADIRAN</p><h2 id="admin-analytics-title">Analitik RSVP</h2></div>
            <p>{stats.responded} dari {stats.total} undangan sudah merespons</p>
          </div>
          <div className="admin-stats" aria-label="Ringkasan tamu dan RSVP">
            <StatCard icon="users" label="Total undangan" value={stats.total} detail="Seluruh tamu terdaftar" tone="blue" active={rsvpFilter === "Semua status"} onClick={() => setRsvpFilter("Semua status")} />
            <StatCard icon="check" label="Akan hadir" value={stats.attending} detail={`${stats.attendanceHeadcount} orang total hadir`} tone="green" active={rsvpFilter === "attending"} onClick={() => setRsvpFilter("attending")} />
            <StatCard icon="clock" label="Belum merespons" value={stats.pending} detail="Perlu tindak lanjut" tone="amber" active={rsvpFilter === "pending"} onClick={() => setRsvpFilter("pending")} />
            <StatCard icon="users" label="Berhalangan hadir" value={stats.declined} detail="Sudah memberi kabar" tone="rose" active={rsvpFilter === "declined"} onClick={() => setRsvpFilter("declined")} />
            <StatCard icon="check" label="Tingkat respons" value={`${stats.responseRate}%`} detail={`${stats.responded} undangan menjawab`} tone="blue" active={false} />
            <StatCard icon="heart" label="Ucapan masuk" value={stats.wishes} detail="Ucapan/doa tersimpan" tone="rose" active={false} />
          </div>
          <div className="admin-response-panel">
            <div className="admin-response-heading"><strong>Progres konfirmasi</strong><span>{stats.total ? `${stats.pending} undangan masih menunggu` : "Belum ada data tamu"}</span></div>
            <div className="admin-response-track" role="img" aria-label={`${stats.attending} hadir, ${stats.declined} berhalangan, ${stats.pending} belum merespons`}>
              <span className="admin-response-attending" style={{ width: `${stats.total ? stats.attending / stats.total * 100 : 0}%` }} />
              <span className="admin-response-declined" style={{ width: `${stats.total ? stats.declined / stats.total * 100 : 0}%` }} />
              <span className="admin-response-pending" style={{ width: `${stats.total ? stats.pending / stats.total * 100 : 0}%` }} />
            </div>
            <div className="admin-response-legend">
              <button onClick={() => setRsvpFilter("attending")}><i className="admin-dot is-attending" />Hadir <b>{stats.attending}</b></button>
              <button onClick={() => setRsvpFilter("declined")}><i className="admin-dot is-declined" />Berhalangan <b>{stats.declined}</b></button>
              <button onClick={() => setRsvpFilter("pending")}><i className="admin-dot is-pending" />Belum merespons <b>{stats.pending}</b></button>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Semua tamu</h2><p>{filteredGuests.length} dari {guests.length} tamu</p></div><button className="admin-button admin-button-light" onClick={exportCsv} disabled={!filteredGuests.length}><Icon name="download" />Ekspor CSV</button></div>
          <div className="admin-filters">
            <label className="admin-search"><Icon name="search" /><span className="sr-only">Cari tamu</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari nama, nomor, relasi..." /></label>
            <label className="admin-filter-label"><span className="sr-only">Filter kategori</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option>Semua kategori</option>{guestCategories.map(category => <option key={category}>{category}</option>)}</select></label>
            <label className="admin-filter-label"><span className="sr-only">Filter RSVP</span><select value={rsvpFilter} onChange={event => setRsvpFilter(event.target.value)}><option>Semua status</option><option value="pending">Belum konfirmasi</option><option value="attending">Hadir</option><option value="declined">Tidak hadir</option></select></label>
          </div>
          {loadError && <div className="admin-inline-error" role="alert"><p>{loadError}</p><button className="admin-button admin-button-light" onClick={() => setRefreshKey(value => value + 1)}>Coba lagi</button></div>}
          {loading ? <div className="admin-empty">Memuat daftar tamu...</div> : !loadError && filteredGuests.length === 0 ? <div className="admin-empty"><span className="admin-empty-icon"><Icon name="users" /></span><h3>{guests.length ? "Tamu tidak ditemukan" : "Belum ada tamu"}</h3><p>{guests.length ? "Coba ubah pencarian atau filter." : "Tambahkan tamu pertama untuk mulai membuat undangan personal."}</p>{!guests.length && <button className="admin-button admin-button-primary" onClick={() => setModal({ type: "form", guest: null })}><Icon name="plus" />Tambah tamu</button>}</div> : !loadError && (
            <>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Tamu</th><th>Kategori</th><th>RSVP</th><th>Ucapan</th><th>WhatsApp</th><th>Aksi</th></tr></thead><tbody>{filteredGuests.map(guest => <GuestRow key={guest.id} guest={guest} onEdit={() => setModal({ type: "form", guest })} onDelete={() => setModal({ type: "delete", guest })} onCopy={() => void copyLink(guest)} onShare={() => setModal({ type: "whatsapp", guest })} />)}</tbody></table></div>
              <div className="admin-mobile-list">{filteredGuests.map(guest => <GuestCard key={guest.id} guest={guest} onEdit={() => setModal({ type: "form", guest })} onDelete={() => setModal({ type: "delete", guest })} onCopy={() => void copyLink(guest)} onShare={() => setModal({ type: "whatsapp", guest })} />)}</div>
            </>
          )}
        </section>
        <p className="admin-privacy-note">Data tamu dan catatan internal hanya tersedia untuk admin yang berwenang.</p>
      </div>

      {modal?.type === "form" && <GuestForm guest={modal.guest} onClose={() => setModal(null)} onSave={saveGuest} />}
      {modal?.type === "delete" && <ConfirmDelete guest={modal.guest} busy={deleting} onCancel={() => setModal(null)} onConfirm={() => void confirmDelete()} />}
      {modal?.type === "whatsapp" && <WhatsAppPreview guest={modal.guest} onClose={() => setModal(null)} onOpened={url => void shareManually(modal.guest, url)} onEdit={() => setModal({ type: "form", guest: modal.guest })} />}
      {modal?.type === "import" && <GuestImportModal guests={guests} onClose={() => setModal(null)} onImported={importedGuests} />}
      {toast && <div className={`admin-toast admin-toast-${toast.type}`} role={toast.type === "error" ? "alert" : "status"} aria-live="polite">{toast.message}</div>}
    </main>
  );
}

function StatCard({ icon, label, value, detail, tone, active, onClick }: {
  icon: "users" | "check" | "clock" | "heart";
  label: string;
  value: number | string;
  detail: string;
  tone: string;
  active: boolean;
  onClick?: () => void;
}) {
  const content = <><span className={`admin-stat-icon admin-tone-${tone}`}><Icon name={icon} /></span><span className="admin-stat-copy"><span className="admin-stat-label">{label}</span><strong>{value}</strong><small>{detail}</small></span></>;
  return onClick
    ? <button type="button" className={`admin-stat-card admin-stat-button ${active ? "is-active" : ""}`} onClick={onClick} aria-pressed={active}>{content}</button>
    : <article className="admin-stat-card">{content}</article>;
}

function GuestRow({ guest, onEdit, onDelete, onCopy, onShare }: { guest: Guest; onEdit: () => void; onDelete: () => void; onCopy: () => void; onShare: () => void }) {
  return <tr>
    <td><div className="admin-guest-name"><span className="admin-guest-avatar">{guest.name.slice(0, 1).toUpperCase()}</span><div><b>{guest.name}</b><small>{guest.phone || "Nomor belum diisi"}{guest.relation ? ` · ${guest.relation}` : ""}</small></div></div></td>
    <td><span className="admin-category">{guest.category}</span></td>
    <td><RsvpBadge status={guest.rsvp_status} count={guest.rsvp_status === "attending" ? guest.party_size : undefined} /></td>
    <td><span className="admin-wish-cell" title={guest.wishes ?? ""}>{guest.wishes?.trim() || <span className="admin-muted">Belum ada</span>}</span></td>
    <td><span className={`admin-wa-status ${guest.whatsapp_status === "opened_manual" ? "is-opened" : ""}`}>{guest.whatsapp_status === "opened_manual" ? "Dibuka manual" : "Belum dibagikan"}</span></td>
    <td><GuestActions guest={guest} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} onShare={onShare} /></td>
  </tr>;
}

function GuestCard({ guest, onEdit, onDelete, onCopy, onShare }: { guest: Guest; onEdit: () => void; onDelete: () => void; onCopy: () => void; onShare: () => void }) {
  return <article className="admin-guest-card">
    <div className="admin-guest-card-head"><span className="admin-guest-avatar">{guest.name.slice(0, 1).toUpperCase()}</span><div><b>{guest.name}</b><small>{guest.phone || "Nomor belum diisi"}</small></div><RsvpBadge status={guest.rsvp_status} count={guest.rsvp_status === "attending" ? guest.party_size : undefined} /></div>
    <div className="admin-card-meta"><span className="admin-category">{guest.category}</span>{guest.relation && <span>{guest.relation}</span>}<span>{guest.whatsapp_status === "opened_manual" ? "WhatsApp dibuka manual" : "Belum dibagikan"}</span></div>
    {guest.wishes?.trim() && <p className="admin-card-wish">“{guest.wishes}”</p>}
    {guest.internal_note && <p className="admin-card-note">Catatan internal: {guest.internal_note}</p>}
    <GuestActions guest={guest} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} onShare={onShare} />
  </article>;
}

function RsvpBadge({ status, count }: { status: RsvpStatus; count?: number }) {
  return <span className={`admin-rsvp admin-rsvp-${status}`}>{rsvpLabels[status]}{count && count > 1 ? ` · ${count} orang` : ""}</span>;
}

function GuestActions({ guest, onEdit, onDelete, onCopy, onShare }: { guest: Guest; onEdit: () => void; onDelete: () => void; onCopy: () => void; onShare: () => void }) {
  return <div className="admin-row-actions">
    <a className="admin-action-button" href={inviteUrl(guest)} target="_blank" rel="noreferrer" aria-label={`Lihat undangan ${guest.name}`} title="Lihat undangan"><Icon name="open" /></a>
    <button className="admin-action-button" onClick={onCopy} aria-label={`Salin tautan ${guest.name}`} title="Salin tautan"><Icon name="copy" /></button>
    <button className="admin-action-button admin-action-whatsapp" onClick={onShare} aria-label={`Bagikan WhatsApp ${guest.name}`} title="Bagikan manual via WhatsApp"><Icon name="message" /></button>
    <button className="admin-action-button" onClick={onEdit} aria-label={`Edit ${guest.name}`} title="Edit"><Icon name="edit" /></button>
    <button className="admin-action-button admin-action-delete" onClick={onDelete} aria-label={`Hapus ${guest.name}`} title="Hapus"><Icon name="trash" /></button>
  </div>;
}

function ConfirmDelete({ guest, busy, onCancel, onConfirm }: { guest: Guest; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <section className="admin-modal admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
      <span className="admin-confirm-icon"><Icon name="trash" /></span><h2 id="delete-title">Hapus {guest.name}?</h2>
      <p id="delete-description">Tindakan ini tidak dapat dibatalkan. Data RSVP dan ucapan yang terkait dengan tamu ini juga akan ikut terhapus.</p>
      <div className="admin-modal-actions"><button className="admin-button admin-button-light" onClick={onCancel} disabled={busy}>Batal</button><button className="admin-button admin-button-danger" onClick={onConfirm} disabled={busy}>{busy ? "Menghapus..." : "Ya, hapus tamu"}</button></div>
    </section>
  </div>;
}

function WhatsAppPreview({ guest, onClose, onOpened, onEdit }: { guest: Guest; onClose: () => void; onOpened: (url: string) => void; onEdit: () => void }) {
  const message = invitationMessage(guest);
  let url = "";
  let numberError = "";
  if (guest.phone) {
    try { url = `https://wa.me/${normalizeWhatsAppNumber(guest.phone)}?text=${encodeURIComponent(message)}`; }
    catch (error) { numberError = error instanceof Error ? error.message : "Nomor tidak valid."; }
  }
  return <div className="admin-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="admin-modal admin-share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div className="admin-modal-heading"><div><p className="admin-eyebrow">BERBAGI MANUAL</p><h2 id="share-title">Undangan WhatsApp</h2></div><button className="admin-icon-button" onClick={onClose} aria-label="Tutup">×</button></div>
      <div className="admin-share-recipient"><span className="admin-guest-avatar">{guest.name.slice(0, 1).toUpperCase()}</span><div><b>{guest.name}</b><small>{guest.phone || "Nomor WhatsApp belum diisi"}</small></div></div>
      <label className="admin-preview-label">Preview pesan<textarea readOnly rows={9} value={message} /></label>
      <p className="admin-share-disclaimer">Pesan hanya dibuka di WhatsApp. Admin tetap perlu menekan tombol Kirim; status ini bukan bukti pesan terkirim.</p>
      {!guest.phone || numberError ? <div className="admin-inline-error"><p>{numberError || "Isi nomor WhatsApp tamu terlebih dahulu untuk membuka percakapan."}</p><button className="admin-button admin-button-light" onClick={onEdit}><Icon name="edit" />Edit nomor</button></div> : <div className="admin-modal-actions"><button className="admin-button admin-button-light" onClick={onClose}>Batal</button><button type="button" className="admin-button admin-button-whatsapp" onClick={() => onOpened(url)}><Icon name="message" />Buka WhatsApp</button></div>}
    </section>
  </div>;
}
