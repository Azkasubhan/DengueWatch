import type { StaticImageData } from "next/image";
import cloggedDrain from "@/features/landing/images/clogged-drain.webp";
import discardedTire from "@/features/landing/images/discarded-tire.webp";
import kerjaBakti from "@/features/landing/images/kerja-bakti.webp";
import memotretTemuan from "@/features/landing/images/memotret-temuan.webp";
import tandonTertutup from "@/features/landing/images/tandon-tertutup.webp";
import waterContainer from "@/features/landing/images/water-container.webp";

// Editable landing content. Team and contact entries are templates for the product owner.

export const findings = [
  {
    category: "Wadah air terbuka",
    image: waterContainer,
    alt: "Ember biru berisi air hujan di halaman rumah.",
    description: "Ember, bak, dan wadah lain yang menampung air hujan.",
    handling: "Dikuras lalu ditutup rapat",
    by: "Warga atau kader",
    proof: "Foto wadah setelah dikuras",
  },
  {
    category: "Ban bekas",
    image: discardedTire,
    alt: "Ban bekas berisi genangan air di halaman.",
    description: "Ban yang menampung genangan di halaman atau lahan kosong.",
    handling: "Dikeringkan dan disingkirkan",
    by: "Kader bersama warga",
    proof: "Foto lokasi setelah dibersihkan",
  },
  {
    category: "Saluran tersumbat",
    image: cloggedDrain,
    alt: "Saluran air tersumbat daun dan sampah plastik.",
    description: "Saluran yang airnya tergenang karena daun atau sampah.",
    handling: "Dibersihkan dalam kerja bakti",
    by: "Kader dan warga",
    proof: "Foto saluran yang kembali mengalir",
  },
];

export const activities = [
  {
    image: tandonTertutup,
    alt: "Drum air biru dengan tutup rapat di samping rumah.",
    badge: "Mingguan",
    title: "PSN 3M Plus di rumah",
    tag: "Warga",
    text: "Menguras, menutup, dan menyingkirkan tempat yang bisa menampung air di rumah masing-masing.",
    when: "Setiap minggu",
  },
  {
    image: kerjaBakti,
    alt: "Dua warga membersihkan saluran dalam kerja bakti.",
    badge: "Bulanan",
    title: "Kerja bakti lingkungan",
    tag: "RT dan RW",
    text: "Membersihkan saluran dan lahan bersama, lalu melaporkan titik yang perlu ditangani lebih lanjut.",
    when: "Setiap bulan",
  },
  {
    image: memotretTemuan,
    alt: "Tangan warga memotret ember berisi air dengan ponsel.",
    badge: "Berkala",
    title: "Pemeriksaan jentik",
    tag: "Kader",
    text: "Kader memeriksa wadah air di lingkungan dan mencatat temuan sebagai laporan yang bisa ditindaklanjuti.",
    when: "Sesuai jadwal wilayah",
  },
];

export const faqs = [
  {
    question: "Apakah DengueWatch bisa mendiagnosis demam berdarah?",
    answer:
      "Tidak. DengueWatch hanya untuk melaporkan dan menangani tempat yang bisa menjadi sarang nyamuk. Jika Anda atau keluarga mengalami gejala, segera periksa ke fasilitas kesehatan.",
  },
  {
    question: "Siapa yang bisa melihat foto dan laporan saya?",
    answer:
      "Anda, serta kader dan pengelola yang bertugas di wilayah laporan tersebut. Foto disimpan privat dan tidak dapat dibuka publik.",
  },
  {
    question: "Apakah lokasi rumah saya dibagikan?",
    answer:
      "Lokasi bersifat opsional; Anda juga bisa menulis petunjuk lokasi saja. Titik lokasi tidak ditampilkan publik dan hanya dapat dilihat petugas di wilayah tersebut. Metadata lokasi di dalam foto dihapus otomatis.",
  },
  {
    question: "Apakah saran AI selalu benar?",
    answer:
      "Tidak selalu. AI hanya mengisi draf formulir dari foto, dan semua kolom bisa Anda ubah. Jika layanan AI sedang tidak tersedia, Anda cukup mengisi kolomnya sendiri.",
  },
  {
    question: "Apa arti status laporan saya?",
    answer:
      "Menunggu Pemeriksaan berarti laporan belum diperiksa pengelola. Terverifikasi dan Dalam Penanganan berarti kader sedang mengerjakan tugasnya. Selesai berarti bukti penanganan sudah disetujui pengelola. Pengelola juga dapat meminta informasi tambahan, menandai laporan duplikat, atau tidak menyetujuinya.",
  },
  {
    question: "Bagaimana cara menjadi kader?",
    answer:
      "Setiap akun baru berperan sebagai warga. Peran kader diberikan setelah penugasan wilayah yang sah. Hubungi pengurus wilayah Anda untuk informasi lebih lanjut.",
  },
];

// Template: replace names, roles, and add `photo` (a static image import) per member.
export const team: {
  name: string;
  role: string;
  photo?: StaticImageData;
}[] = [
  { name: "Nama Anggota", role: "Peran di tim" },
  { name: "Nama Anggota", role: "Peran di tim" },
  { name: "Nama Anggota", role: "Peran di tim" },
];

// Template: fill in the channels you use. Empty values are not shown in the footer.
export const contacts: { label: string; value: string; href: string }[] = [
  { label: "Email", value: "", href: "" },
  { label: "WhatsApp", value: "", href: "" },
  { label: "Instagram", value: "", href: "" },
  { label: "Alamat", value: "", href: "" },
];
