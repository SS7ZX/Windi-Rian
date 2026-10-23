import { useRef, useState } from "react";
import { C, P } from "./config";
import { useCountdown, useReveal } from "./hooks";

const guest = new URLSearchParams(location.search).get("to") || "";
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
  `Ngunduh Mantu ${C.groom} & ${C.bride}`)}&dates=20261107T020000Z/20261107T070000Z&location=${encodeURIComponent(C.address)}`;

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

function Gift({ bank, no, name }: { bank: string; no: string; name: string }) {
  const [ok, setOk] = useState(false);
  const copy = () => navigator.clipboard.writeText(no).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); });
  return (
    <div className="atm rv">
      <b>{bank}</b><div className="no">{no}</div><small>a.n. {name}</small>
      <button onClick={copy}>{ok ? "Tersalin ✓" : "Salin nomor"}</button>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<"tutup" | "sapa" | "buka">("tutup");
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [f, setF] = useState({ nama: guest, hadir: "ya", jml: 1, ucap: "" });
  const audio = useRef<HTMLAudioElement>(null);
  const cd = useCountdown(C.countdownTarget);
  useReveal();

  const buka = () => {
    setPhase("sapa");
    audio.current?.play().then(() => setPlaying(true)).catch(() => {});
    setTimeout(() => { setPhase("buka"); document.body.classList.remove("lock"); window.scrollTo(0, 0); }, 1200);
  };
  const toggleMusic = () => {
    const a = audio.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };
  const kirim = () => {
    const status = f.hadir === "ya" ? `insya Allah hadir (${f.jml} orang)` : "mohon maaf belum bisa hadir";
    const msg = `Assalamu'alaikum, saya ${f.nama || "tamu undangan"}, ${status} di pernikahan ${C.groom} & ${C.bride}.${f.ucap ? `\n\nUcapan: ${f.ucap}` : ""}`;
    window.open(`https://wa.me/${C.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <>
      <audio ref={audio} src="/musik.mp3" loop preload="none" />
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
          <p className="dear">Dengan penuh rasa syukur, kami mengundang</p>
          <p className="gname">{guest || "Tamu Undangan"}</p>
          <p className="cover-note">untuk hadir dan memberikan doa restu</p>
          <button className="open" onClick={buka} disabled={phase !== "tutup"}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
            Buka Undangan
          </button>
          <p className="sorry">Mohon maaf apabila terdapat kesalahan penulisan nama atau gelar</p>
        </div>
      </div>

      {phase === "buka" && (<>
        <button className="music" onClick={toggleMusic} aria-label="Musik">{playing ? "❚❚" : "♪"}</button>
        <nav className="nav">{[["salam", "Awal"], ["mempelai", "Mempelai"], ["acara", "Acara"], ["galeri", "Galeri"], ["kado", "Kado"], ["rsvp", "RSVP"]].map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}</nav>
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
        <div className="evt rv"><small>Akad Nikah</small><b className="gold">{C.timeAkad}</b><p>{C.date}</p></div>
        <div className="evt rv"><small>Resepsi</small><b className="gold">{C.timeResepsi}</b><p>{C.date}</p></div>
        <div className="evt rv"><small>{C.venue}</small><p>{C.address}</p>
          <a className="btn" href={C.mapsUrl} target="_blank" rel="noreferrer">Buka Google Maps</a>
          <a className="btn ghost" href={cal} target="_blank" rel="noreferrer">Simpan ke kalender</a></div>
      </section>

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
            <span aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          </button>
        ))}</div>
      </section>

      <section id="kado" className="sec alt">
        <h2 className="gold">Kado Digital</h2>
        <p className="small">Doa restu Anda sudah cukup bagi kami. Bila ingin berbagi kebahagiaan, dapat melalui:</p>
        {C.banks.map(b => <Gift key={b.no} {...b} />)}
      </section>

      <section id="rsvp" className="sec">
        <h2 className="gold">Konfirmasi Kehadiran</h2>
        <div className="form rv">
          <input placeholder="Nama" value={f.nama} onChange={e => setF({ ...f, nama: e.target.value })} />
          <div className="seg">
            <button className={f.hadir === "ya" ? "on" : ""} onClick={() => setF({ ...f, hadir: "ya" })}>Hadir</button>
            <button className={f.hadir === "tidak" ? "on" : ""} onClick={() => setF({ ...f, hadir: "tidak" })}>Berhalangan</button>
          </div>
          {f.hadir === "ya" && <div className="step">
            <button onClick={() => setF({ ...f, jml: Math.max(1, f.jml - 1) })} aria-label="Kurangi">−</button><span>{f.jml} orang</span>
            <button onClick={() => setF({ ...f, jml: Math.min(6, f.jml + 1) })} aria-label="Tambah">+</button></div>}
          <textarea rows={3} placeholder="Ucapan & doa (opsional)" value={f.ucap} onChange={e => setF({ ...f, ucap: e.target.value })} />
          <button className="btn" onClick={kirim}>Kirim via WhatsApp</button>
        </div>
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