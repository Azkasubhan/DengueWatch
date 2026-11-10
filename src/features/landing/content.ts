import cloggedDrain from "@/features/landing/images/clogged-drain.webp";
import discardedTire from "@/features/landing/images/discarded-tire.webp";
import waterContainer from "@/features/landing/images/water-container.webp";

// Editable landing content. Contact entries are a template for the product owner.

export const findings = [
  {
    category: "Wadah air terbuka",
    image: waterContainer,
    alt: "Ember biru berisi air hujan di halaman rumah.",
    description:
      "Ember, bak, drum, atau wadah terbuka di sekitar rumah yang menampung air hujan dan berisiko menjadi tempat berkembang biak jentik nyamuk.",
  },
  {
    category: "Ban bekas",
    image: discardedTire,
    alt: "Ban bekas berisi genangan air di halaman.",
    description:
      "Ban bekas atau barang tak terpakai di halaman dan lahan kosong yang menahan genangan air setelah hujan.",
  },
  {
    category: "Saluran tersumbat",
    image: cloggedDrain,
    alt: "Saluran air tersumbat daun dan sampah plastik.",
    description:
      "Saluran drainase atau selokan lingkungan yang alirannya terhambat daun dan sampah sehingga air menggenang.",
  },
];

// Template: fill in the channels you use. Empty values are not shown in the footer.
export const contacts: { label: string; value: string; href: string }[] = [
  { label: "Email", value: "", href: "" },
  { label: "WhatsApp", value: "", href: "" },
  { label: "Instagram", value: "", href: "" },
  { label: "Alamat", value: "", href: "" },
];
