import { useEffect, useRef, useState, type FormEvent } from "react";
import { C, P } from "./config";
import { useCountdown, useReveal } from "./hooks";
import { lookupInvite, submitInviteMessage, submitInviteRsvp, type RsvpChoice } from "./admin/public-invite";

const LIVE = ""; // isi link YouTube Live (https://...) kalau ada siaran langsung, kosongkan kalau tidak
const TL = [ // edit cerita sesuai kisah kalian
  { img: P[3], t: "Pertama Bertemu", d: "Dua orang asing yang tak menyangka akan saling menemukan." },
  { img: P[4], t: "Mulai Dekat", d: "Obrolan sederhana yang pelan-pelan jadi kebiasaan." },
  { img: P[6], t: "Saling Yakin", d: "Dari sekadar nyaman, tumbuh jadi keyakinan." },
  { img: P[7], t: "Dua Keluarga Bertemu", d: "Restu orang tua menjadi langkah terindah." },
  { img: P[8], t: "Menyiapkan Hari Bahagia", d: "Satu per satu rencana kami rangkai bersama." },
  { img: P[9], t: "Hari Ini", d: "Kami melangkah menuju ikatan yang suci." },
];
const cal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
  `Ngunduh Mantu ${C.groom} & ${C.bride}`)}&dates=20261129T030000Z/20261129T080000Z&location=${encodeURIComponent(C.address || C.venue)}`;

const Medal = ({ id }: { id: string }) => (
  <svg className="medal" viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6e2a6" /><stop offset="1" stopColor="#9a7627" /></linearGradient></defs>
    <g fill="none" stroke={`url(#${id})`} strokeWidth="1.2">
      <circle cx="50" cy="50" r="42" /><circle cx="50" cy="50" r="47" strokeDasharray="1 3" />
      <path d="M50 12C42 20 39 29 40 37C41 45 37 51 31 55C38 56 45 52 49 46V59C49 65 46 70 41 74C46 75 49 73 50 70C51 73 54 75 59 74C54 70 51 65 51 59V46C55 52 62 56 69 55C63 51 59 45 60 37C61 29 58 20 50 12Z" fill="#c9a24a" fillOpacity=".2" />
      <path d="M50 18C45 25 42 32 43 38C44 45 40 51 35 55C41 54 46 50 49 45V71C49 75 47 78 45 82M51 45V71C51 75 53 78 55 82M50 55V82M45 77L50 82L55 77" />
      <path d="M30 54c-8-1-12 3-10 8 2 4 8 4 9 0 0-3-3-4-5-2m46-6c8-1 12 3 10 8-2 4-8 4-9 0 0-3 3-4 5-2M29 70c6-4 11-4 16 0m30 0c-6-4-11-4-16 0" />
    </g>
  </svg>
);

function Bride({ img, role, full, parent }: { img: string; role: string; full: string; parent: string }) {
  return (
    <div className="mem rv">
      <img src={img} alt={full} loading="lazy" />
      <div className="cap"><h3 className="gold">{full}</h3><small>{role}</small><p>{parent}</p></div>
    </div>
  );
}

export default function App() {
  const [inviteSlug] = useState(() => new URLSearchParams(location.search).get("invite"));
  const [phase, setPhase] = useState<"tutup" | "sapa" | "buka">("tutup");
  const [zoom, setZoom] = useState<string | null>(null);
  const [guest, setGuest] = useState(inviteSlug ? "" : "Tamu Undangan");
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteSlug));
  const [inviteError, setInviteError] = useState("");
  const [rsvpChoice, setRsvpChoice] = useState<RsvpChoice | "">("");
  const [partySize, setPartySize] = useState(1);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [rsvpSuccess, setRsvpSuccess] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [messageSuccess, setMessageSuccess] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const cd = useCountdown(C.countdownTarget);
  useReveal();

  useEffect(() => {
    if (!inviteSlug) return;
    let active = true;
    lookupInvite(inviteSlug).then(name => {
      if (active) setGuest(name);
    }).catch(error => {
      if (!active) return;
      setGuest("Tamu Undangan");
      setInviteError(error instanceof Error ? error.message : "Undangan personal tidak dapat dimuat.");
    }).finally(() => { if (active) setInviteLoading(false); });
    return () => { active = false; };
  }, [inviteSlug]);

  const submitRsvp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteSlug || !rsvpChoice || inviteLoading || inviteError) return;
    setRsvpBusy(true);
    setRsvpError("");
    setRsvpSuccess("");
    try {
      await submitInviteRsvp(inviteSlug, rsvpChoice, partySize);
      setRsvpSuccess(`Terima kasih, konfirmasi untuk ${guest} berhasil disimpan.`);
    } catch (error) {
      setRsvpError(error instanceof Error ? error.message : "Konfirmasi gagal disimpan. Silakan coba lagi.");
    } finally {
      setRsvpBusy(false);
    }
  };

  const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteSlug || inviteLoading || inviteError || messageSuccess) return;
    setMessageBusy(true);
    setMessageError("");
    try {
      await submitInviteMessage(inviteSlug, guestMessage);
      setMessageSuccess("Pesan berhasil dikirim. Terima kasih sudah berbagi doa dan harapan.");
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Pesan gagal dikirim. Silakan coba lagi.");
    } finally {
      setMessageBusy(false);
    }
  };

  const buka = () => {
    setPhase("sapa");
    audio.current?.play().catch(() => {});
    setTimeout(() => { setPhase("buka"); document.body.classList.remove("lock"); window.scrollTo(0, 0); }, 1200);
  };
  return (
    <>
      <audio ref={audio} src="/musik.mp3" loop autoPlay preload="auto" />
      <div className="progress" />

      <div className={`gate ${phase}`}>
        <img className="bg" src={P[0]} alt="" fetchPriority="high" />
        <div className="shade" />
        <div className="gate-frame" aria-hidden="true" />
        <div className="gate-top">
          <p className="cover-kicker">Ngunduh Mantu</p>
          <img className="cover-ornament" src="/ornaments/sunda-scroll.svg" alt="" />
          <h1 className="cover-names script">{C.groom}<span>&amp;</span>{C.bride}</h1>
          <p className="cover-date">{C.dateFormal}</p>
        </div>
        <div className="gate-in">
          <p className="dear">Kepada Yth.</p>
          <p className="gname" aria-live="polite">{inviteLoading ? "Memuat undangan..." : guest || "Tamu Undangan"}</p>
          {inviteError && <p className="cover-note" role="status">{inviteError}</p>}
          <p className="cover-note">Dengan hormat kami mengundang untuk hadir dan memberikan doa restu</p>
          <button className="open" onClick={buka} disabled={phase !== "tutup" || inviteLoading}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            {inviteLoading ? "Memuat..." : "Buka Undangan"}
          </button>
          <p className="sorry">Mohon maaf apabila terdapat kesalahan penulisan nama atau gelar</p>
        </div>
      </div>

      {phase === "buka" && (<>
        <nav className="nav">{[["salam", "Awal"], ["mempelai", "Mempelai"], ["acara", "Acara"], ...(inviteSlug && !inviteLoading && !inviteError ? [["konfirmasi", "RSVP"], ["pesan", "Pesan"]] : []), ["galeri", "Galeri"]].map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}</nav>
      </>)}

      <section id="salam" className="sec">
        <Medal id="g2" />
        <p className="label rv">Assalamu'alaikum Wr. Wb.</p>
        <p className="rv">{C.blessing}</p>
        <p className="gold script rv">Rampes, wilujeng sumping</p>
      </section>

      <section id="mempelai" className="sec alt">
        <h2 className="gold">Mempelai</h2>
        <Bride img={P[1]} role="Putra dari" full={C.groomFull} parent={C.parentGroom} />
        <p className="amp gold">&amp;</p>
        <Bride img={P[2]} role="Putri dari" full={C.brideFull} parent={C.parentBride} />
      </section>

      <section className="sec">
        <h2 className="gold">Perjalanan Kami</h2>
        <p className="small">Perjalanan yang tak terduga, dan perjalanan yang mengubah tujuan hidup kami.</p>
        <ol className="tl">
          {TL.map(x => (
            <li key={x.t} className="rv"><img src={x.img} alt="" loading="lazy" /><h3 className="gold">{x.t}</h3><p>{x.d}</p></li>
          ))}
        </ol>
      </section>

      <section className="quote">
        <img className="bg" src={P[5]} alt="" loading="lazy" /><div className="shade" />
        <div className="rv">
          <p className="gold script big">Silih asih, silih asah, silih asuh.</p>
          <p>Dan di antara tanda-tanda kekuasaan-Nya ialah Dia menciptakan pasangan-pasangan untukmu dari jenismu sendiri, agar kamu merasa tenteram kepadanya.</p>
          <small>QS. Ar-Rum: 21</small>
        </div>
      </section>

      <section id="acara" className="sec alt">
        <h2 className="gold">Hari Bahagia</h2>
        <div className="cd rv">{Object.entries({ Hari: cd.Hari, Jam: cd.Jam, Menit: cd.Menit, Detik: cd.Detik }).map(([k, v]) => <div key={k}><b>{String(v).padStart(2, "0")}</b><small>{k}</small></div>)}</div>
        <div className="evt rv"><small>Ngunduh Mantu</small><b className="gold">{C.timeAkad}</b><p>{C.date}</p></div>
        <div className="evt rv"><small>Resepsi</small><b className="gold">{C.timeResepsi}</b><p>{C.date}</p></div>
        <div className="evt rv"><small>{C.venue}</small>{C.address && <p>{C.address}</p>}
          <a className="btn" href={C.mapsUrl} target="_blank" rel="noreferrer">Buka Google Maps</a>
          <a className="btn ghost" href={cal} target="_blank" rel="noreferrer">Simpan ke kalender</a></div>
        {inviteSlug && !inviteLoading && !inviteError && <a className="btn" href="#konfirmasi">Konfirmasi Kehadiran</a>}
      </section>

      {inviteSlug && !inviteLoading && !inviteError && (
        <section id="konfirmasi" className="sec">
          <h2 className="gold">Konfirmasi Kehadiran</h2>
          <p className="small">Konfirmasi untuk {guest}. Pilih jawaban dan jumlah yang hadir.</p>
          <form className="rsvp-form" onSubmit={submitRsvp}>
            <label>
              Konfirmasi kehadiran
              <select required value={rsvpChoice} onChange={event => setRsvpChoice(event.target.value as RsvpChoice | "")}>
                <option value="">Pilih jawaban</option>
                <option value="attending">Insyaallah hadir</option>
                <option value="declined">Mohon maaf, tidak dapat hadir</option>
              </select>
            </label>
            {rsvpChoice === "attending" && <label>
              Jumlah yang hadir
              <select value={partySize} onChange={event => setPartySize(Number(event.target.value))}>
                {[1, 2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} orang</option>)}
              </select>
            </label>}
            {rsvpError && <p className="rsvp-message rsvp-error" role="alert">{rsvpError}</p>}
            {rsvpSuccess && <p className="rsvp-message rsvp-success" role="status">{rsvpSuccess}</p>}
            <button className="btn" type="submit" disabled={rsvpBusy || !rsvpChoice}>
              {rsvpBusy ? "Menyimpan..." : rsvpSuccess ? "Perbarui Konfirmasi" : "Kirim Konfirmasi"}
            </button>
          </form>
        </section>
      )}

      {inviteSlug && !inviteLoading && !inviteError && (
        <section id="pesan" className="sec alt">
          <h2 className="gold">Kirim Pesan</h2>
          <p className="small">Sampaikan doa, ucapan, atau pesan untuk Rian &amp; Windi. Pesan hanya dapat dibaca oleh admin undangan.</p>
          <form className="rsvp-form" onSubmit={submitMessage}>
            <label htmlFor="guest-message">Pesan untuk kedua mempelai</label>
            <textarea
              id="guest-message"
              required
              maxLength={2000}
              rows={5}
              value={guestMessage}
              onChange={event => {
                setGuestMessage(event.target.value);
                setMessageError("");
                setMessageSuccess("");
              }}
              placeholder="Tuliskan doa dan pesan Anda di sini..."
            />
            <small className="message-character-count">{guestMessage.length}/2000 karakter</small>
            {messageError && <p className="rsvp-message rsvp-error" role="alert">{messageError}</p>}
            {messageSuccess && <p className="rsvp-message rsvp-success" role="status">{messageSuccess}</p>}
            <button className="btn" type="submit" disabled={messageBusy || !guestMessage.trim() || Boolean(messageSuccess)}>
              {messageBusy ? "Mengirim..." : messageSuccess ? "Pesan Terkirim" : "Kirim Pesan"}
            </button>
          </form>
        </section>
      )}

      {LIVE && (
        <section className="sec">
          <p className="label">Kami akan melakukan</p>
          <h2 className="gold script">Live Streaming</h2>
          <p className="small">Momen akad dan resepsi dapat disaksikan secara virtual melalui YouTube Live.</p>
          <a className="btn" href={LIVE} target="_blank" rel="noreferrer">Tonton Siaran Langsung</a>
        </section>
      )}

      <section id="galeri" className="sec">
        <h2 className="gold">Galeri</h2>
        <p className="small">Momen indah yang kami simpan bersama.</p>
        <div className="gallery">{P.slice(10, 14).map((s, i) => (
          <button key={s} className="gallery-photo" onClick={() => setZoom(s)} aria-label={`Perbesar foto ${i + 1} dari 4`}>
            <img src={s} alt="" loading="lazy" />
          </button>
        ))}</div>
      </section>

      <footer className="sec alt foot">
        <Medal id="g3" />
        <p className="gold script">Hatur nuhun</p>
        <p>Atas kehadiran dan doa restu Bapak/Ibu/Saudara/i, kami ucapkan terima kasih. Wassalamu'alaikum Wr. Wb.</p>
        <h2 className="gold script big">{C.groom} &amp; {C.bride}</h2>
        <p className="small">Keluarga {C.parentGroom}<br />dan<br />{C.parentBride}</p>
      </footer>

      {zoom && <div className="lb" onClick={() => setZoom(null)}><img src={zoom} alt="" /></div>}
    </>
  );
}