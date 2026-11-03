import type { Metadata } from "next";
import { LegalPage } from "@/features/landing/components/LegalPage";

export const metadata: Metadata = { title: "Syarat Layanan" };

export default function TermsPage() {
  return (
    <LegalPage title="Syarat Layanan" updated="3 November 2026">
      <section>
        <h2>Tentang layanan</h2>
        <p>
          DengueWatch membantu warga, kader, dan pengelola wilayah melaporkan
          serta menangani tempat yang berpotensi menjadi sarang nyamuk.
          DengueWatch bukan layanan medis, tidak mendiagnosis penyakit, dan
          tidak memprediksi wabah. Untuk keluhan kesehatan, segera hubungi
          fasilitas kesehatan.
        </p>
      </section>
      <section>
        <h2>Akun dan peran</h2>
        <ul>
          <li>
            Setiap pendaftaran membuat akun warga. Peran kader dan pengelola
            hanya diberikan setelah penugasan wilayah yang sah.
          </li>
          <li>
            Anda bertanggung jawab menjaga kerahasiaan kata sandi dan aktivitas
            pada akun Anda.
          </li>
          <li>
            Akses wilayah dapat ditinjau atau dicabut bila penugasan berakhir
            atau terjadi penyalahgunaan.
          </li>
        </ul>
      </section>
      <section>
        <h2>Ketentuan laporan</h2>
        <ul>
          <li>
            Laporkan temuan yang benar-benar Anda lihat, dengan foto lingkungan
            yang relevan.
          </li>
          <li>
            Hindari memotret wajah, plat kendaraan, atau alamat rumah orang
            lain.
          </li>
          <li>
            Jangan mengunggah konten yang menyesatkan, menyinggung, atau
            melanggar hak orang lain.
          </li>
          <li>
            Kader dapat meminta informasi tambahan, menandai laporan sebagai
            duplikat, atau tidak menyetujui laporan yang tidak sesuai.
          </li>
        </ul>
      </section>
      <section>
        <h2>Saran AI</h2>
        <p>
          Saran AI adalah draf yang dapat Anda ubah atau abaikan. Keputusan isi
          laporan tetap berada pada Anda, dan keputusan verifikasi tetap berada
          pada kader.
        </p>
      </section>
      <section>
        <h2>Penyelesaian laporan</h2>
        <p>
          Laporan dinyatakan selesai setelah bukti penanganan disetujui oleh
          kader yang berbeda dari pelaksana tugas. Riwayat tindakan dicatat dan
          tidak dapat diubah.
        </p>
      </section>
      <section>
        <h2>Ketersediaan layanan</h2>
        <p>
          Kami berupaya menjaga layanan tetap tersedia, tetapi layanan dapat
          terganggu karena pemeliharaan atau gangguan pihak ketiga. Jika layanan
          AI tidak tersedia, laporan tetap dapat dikirim secara manual.
        </p>
      </section>
      <section>
        <h2>Perubahan syarat</h2>
        <p>
          Syarat ini dapat diperbarui mengikuti perkembangan layanan. Dengan
          terus menggunakan DengueWatch, Anda menyetujui syarat yang berlaku.
        </p>
      </section>
    </LegalPage>
  );
}
