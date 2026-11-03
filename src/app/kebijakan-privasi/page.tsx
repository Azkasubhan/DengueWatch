import type { Metadata } from "next";
import { LegalPage } from "@/features/landing/components/LegalPage";

export const metadata: Metadata = { title: "Kebijakan Privasi" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="3 November 2026">
      <section>
        <h2>Data yang kami kumpulkan</h2>
        <ul>
          <li>
            Data akun: nama panggilan, alamat email, dan kata sandi. Kata sandi
            disimpan sebagai hash oleh layanan autentikasi dan tidak dapat kami
            baca.
          </li>
          <li>
            Data laporan: foto, kategori, deskripsi, serta lokasi yang Anda
            pilih untuk dibagikan, baik titik lokasi maupun petunjuk tertulis.
          </li>
          <li>
            Riwayat tindakan: perubahan status laporan dan tugas, beserta waktu
            dan petugas yang melakukannya.
          </li>
        </ul>
      </section>
      <section>
        <h2>Cara kami melindungi foto dan lokasi</h2>
        <p>
          Setiap foto diproses ulang di server sebelum disimpan, dan metadata di
          dalamnya, termasuk lokasi GPS, dihapus otomatis. Foto disimpan di
          penyimpanan privat dan hanya dapat dibuka melalui tautan sementara
          oleh pengguna yang berwenang.
        </p>
        <p>
          Lokasi bersifat opsional. Titik lokasi tidak ditampilkan publik dan
          hanya dapat dilihat oleh Anda serta kader dan pengelola yang bertugas
          di wilayah laporan. Jika mereka memilih membuka titik tersebut di
          Google Maps, koordinatnya dikirim ke Google untuk menampilkan peta.
        </p>
      </section>
      <section>
        <h2>Siapa yang dapat melihat data Anda</h2>
        <ul>
          <li>Anda dapat melihat laporan dan riwayat laporan Anda sendiri.</li>
          <li>
            Kader dapat melihat laporan di wilayah tugasnya untuk memverifikasi
            dan menindaklanjutinya.
          </li>
          <li>
            Pengelola dapat membaca laporan, tugas, dan ringkasan di wilayah
            kelolanya, tanpa mengubahnya.
          </li>
        </ul>
        <p>
          Akses ini ditegakkan di server dan basis data, bukan hanya di tampilan
          aplikasi.
        </p>
      </section>
      <section>
        <h2>Saran AI</h2>
        <p>
          Jika Anda meminta saran AI, satu foto laporan yang sudah dibersihkan
          dari metadata dikirim ke layanan AI pihak ketiga (Google Gemini) untuk
          menghasilkan draf kategori dan deskripsi. Koordinat lokasi tidak
          dikirim. Hanya saran AI terakhir yang ikut tersimpan bersama laporan
          dan dihapus otomatis setelah 30 hari; saran lain yang tidak terpakai
          dihapus setelah 24 jam. Saran AI bukan diagnosis dan tidak pernah
          mengirim laporan tanpa persetujuan Anda.
        </p>
      </section>
      <section>
        <h2>Penyedia layanan</h2>
        <p>
          Data disimpan menggunakan layanan basis data, autentikasi, dan
          penyimpanan cloud dari Supabase. Kami tidak menjual data Anda dan
          tidak memakai pelacak iklan. Cookie hanya digunakan untuk menjaga sesi
          masuk Anda.
        </p>
      </section>
      <section>
        <h2>Hak Anda</h2>
        <p>
          Anda dapat meminta salinan, koreksi, atau penghapusan data akun Anda
          dengan menghubungi kami melalui kontak yang tercantum di bagian bawah
          halaman. Catatan riwayat tindakan pada laporan yang sudah diproses
          dapat tetap disimpan untuk menjaga keutuhan jejak penanganan.
        </p>
      </section>
      <section>
        <h2>Perubahan kebijakan</h2>
        <p>
          Kami dapat memperbarui kebijakan ini mengikuti perubahan fitur.
          Tanggal pembaruan terakhir selalu tercantum di bagian atas halaman.
        </p>
      </section>
    </LegalPage>
  );
}
