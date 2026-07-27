// Raw source datasets — simulate what different Tableau exports look like
// before names are reconciled. Intentional issues let the validation view
// demonstrate missing / duplicate / unmatched names.

export type SourceKey = "leads" | "sales" | "adSpend";

export type SourceRow = {
  name: string; // as-typed name from the source system
  value: number;
};

export type SourceDataset = {
  key: SourceKey;
  label: string;
  rows: SourceRow[];
};

// Canonical names align to src/lib/dealerships.ts. Sources deliberately
// contain typos, casing drift, missing rows and duplicates.
export const SOURCES: SourceDataset[] = [
  {
    key: "leads",
    label: "Leads (CRM export)",
    rows: [
      { name: "Parkland Dodge", value: 649 },
      { name: "Acura of Hamilton", value: 190 },
      { name: "Porsche Centre London", value: 133 },
      { name: "Dodge City Motors", value: 500 },
      { name: "Tower Chrysler Dodge Jeep", value: 354 },
      { name: "Courtesy Chrysler", value: 381 },
      { name: "Audi Windsor", value: 267 },
      { name: "Hyatt Infiniti", value: 297 },
      { name: "Maple Ridge VW", value: 528 }, // alias for Maple Ridge Volkswagen
      { name: "Cambridge Hyundai", value: 503 },
      { name: "Planete Mazda", value: 387 },
      { name: "Plaza Nissan", value: 673 },
      { name: "Rose City Ford", value: 746 },
      { name: "Northland Volkswagen", value: 739 },
      { name: "401 Dixie Hyundai", value: 412 },
      { name: "London Honda", value: 358 },
      { name: "Sherwood Park Volkswagen", value: 221 },
      { name: "BMW Montréal Centre", value: 263 }, // accent typo
      { name: "McNaught Cadillac Buick", value: 198 },
      { name: "St. James Volkswagen", value: 791 },
      { name: "Moncton Chrysler", value: 301 },
      { name: "Waterloo Honda", value: 321 },
      { name: "BMW Laval", value: 242 },
      { name: "Crosstown Auto Centre", value: 655 },
      { name: "Mann-Northway Auto", value: 213 },
      { name: "Crowfoot Hyundai", value: 260 },
      { name: "Guelph Kia", value: 418 },
      { name: "Fish Creek Nissan", value: 467 },
      { name: "Grande Prairie Subaru", value: 288 },
      { name: "Wellington Motors", value: 312 },
      { name: "Wellington Motors", value: 0 }, // duplicate row
      { name: "Kelowna Toyota", value: 145 }, // unmatched — no such dealership
    ],
  },
  {
    key: "sales",
    label: "Sales (DMS export)",
    rows: [
      { name: "Parkland Dodge", value: 42 },
      { name: "Acura Hamilton", value: 24 }, // alias
      { name: "Porsche Centre London", value: 15 },
      { name: "Dodge City Motors", value: 72 },
      { name: "Tower Chrysler Dodge Jeep", value: 55 },
      { name: "Courtesy Chrysler", value: 53 },
      { name: "Audi Windsor", value: 44 },
      { name: "Hyatt Infiniti", value: 52 },
      { name: "Maple Ridge Volkswagen", value: 82 },
      { name: "Cambridge Hyundai", value: 65 },
      { name: "Planete Mazda", value: 95 },
      { name: "Plaza Nissan", value: 73 },
      { name: "Rose City Ford", value: 132 },
      { name: "Northland Volkswagen", value: 107 },
      { name: "401 Dixie Hyundai", value: 35 },
      { name: "London Honda", value: 71 },
      { name: "Sherwood Park Volkswagen", value: 49 },
      { name: "BMW Montreal Centre", value: 38 },
      { name: "McNaught Cadillac Buick", value: 37 },
      { name: "St James Volkswagen", value: 144 }, // missing period alias
      { name: "Moncton Chrysler", value: 40 },
      { name: "Waterloo Honda", value: 59 },
      { name: "BMW Laval", value: 47 },
      { name: "Crosstown Auto Centre", value: 165 },
      { name: "Mann-Northway Auto", value: 30 },
      { name: "Crowfoot Hyundai", value: 45 },
      { name: "Guelph Kia", value: 73 },
      { name: "Fish Creek Nissan", value: 80 },
      { name: "Grande Prairie Subaru", value: 46 },
      // Wellington Motors missing entirely
    ],
  },
  {
    key: "adSpend",
    label: "Ad Spend (Media buy)",
    rows: [
      { name: "Parkland Dodge", value: 78000 },
      { name: "Acura of Hamilton", value: 34000 },
      { name: "Porsche Centre London", value: 41000 },
      { name: "Dodge City Motors", value: 58000 },
      { name: "Tower Chrysler Dodge Jeep", value: 46000 },
      { name: "Courtesy Chrysler", value: 44000 },
      { name: "Audi Windsor", value: 52000 },
      { name: "Hyatt Infiniti", value: 48000 },
      { name: "Maple Ridge Volkswagen", value: 64000 },
      { name: "Cambridge Hyundai", value: 51000 },
      { name: "Planete Mazda", value: 42000 },
      { name: "Plaza Nissan", value: 68000 },
      { name: "Rose City Ford", value: 82000 },
      { name: "Northland VW", value: 74000 }, // alias
      { name: "401 Dixie Hyundai", value: 46000 },
      { name: "London Honda", value: 40000 },
      { name: "Sherwood Park Volkswagen", value: 32000 },
      { name: "BMW Montreal Centre", value: 54000 },
      { name: "McNaught Cadillac Buick", value: 44000 },
      { name: "St. James Volkswagen", value: 68000 },
      { name: "Moncton Chrysler", value: 36000 },
      { name: "Waterloo Honda", value: 42000 },
      { name: "BMW Laval", value: 56000 },
      { name: "Crosstown Auto Centre", value: 71000 },
      { name: "Mann-Northway Auto", value: 34000 },
      { name: "Crowfoot Hyundai", value: 38000 },
      { name: "Guelph Kia", value: 44000 },
      { name: "Fish Creek Nissan", value: 48000 },
      { name: "Grande Prairie Subaru", value: 32000 },
      { name: "Wellington Motors", value: 38000 },
      { name: "Halifax Hyundai", value: 21000 }, // unmatched — no such dealership
    ],
  },
];
