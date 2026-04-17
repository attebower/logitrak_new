/**
 * UK Studios reference seed data
 * Source: logitrack_uk_studios_reference.docx — April 2026
 * Run this to populate the recommended studios list for a workspace.
 */

export const UK_STUDIOS = [
  {
    name: "Pinewood Studios",
    location: "Iver Heath, Buckinghamshire",
    sections: [
      {
        name: "Pinewood West — Original Lot",
        notes: "Disney-held. Historic site, home of the 007 Stage.",
        stages: [
          { name: "007 Stage (Albert R. Broccoli Stage)", size: "59,092 sqft", notes: "World-famous. 5,500 sqm. Disney-held." },
          { name: "The Roger Moore Stage", size: "38,789 sqft", notes: "Named 2017. Disney-held." },
          { name: "The Richard Attenborough Stage", size: "30,044 sqft", notes: "Disney-held." },
          { name: "Q Stage", size: "30,104 sqft", notes: "Disney-held." },
          { name: "V Stage", size: "29,888 sqft", notes: "Disney-held." },
          { name: "S Stage", size: "~22,000 sqft" },
          { name: "R Stage", size: "~18,000 sqft" },
          { name: "U Stage", size: "~16,000 sqft" },
          { name: "N Stage", size: "~14,000 sqft" },
          { name: "M Stage", size: "~13,000 sqft" },
          { name: "F Stage", size: "~12,000 sqft" },
          { name: "L Stage", size: "~11,000 sqft" },
          { name: "A Stage", size: "~10,000 sqft" },
          { name: "B Stage", size: "~10,000 sqft" },
          { name: "C Stage", size: "~10,000 sqft" },
          { name: "D Stage", size: "~10,000 sqft" },
          { name: "E Stage", size: "~10,000 sqft" },
          { name: "W Stage", size: "~10,000 sqft" },
          { name: "X Stage", size: "~10,000 sqft" },
          { name: "Z Stage", size: "~10,000 sqft" },
          { name: "Underwater Stage", size: "N/A", notes: "Purpose-built underwater filming stage." },
        ],
      },
      {
        name: "Pinewood East — Newer Expansion Lot",
        notes: "Disney-held. Numbered stages.",
        stages: [
          { name: "Stage 1", size: "~20,000 sqft" },
          { name: "Stage 2", size: "~20,000 sqft" },
          { name: "Stage 3", size: "~20,000 sqft" },
          { name: "Stage 4", size: "~20,000 sqft" },
          { name: "Stage 5", size: "~20,000 sqft" },
          { name: "Stage 6", size: "~20,000 sqft" },
          { name: "Stage 7", size: "~20,000 sqft" },
          { name: "Stage 8", size: "~20,000 sqft" },
          { name: "Stage 9", size: "~20,000 sqft" },
          { name: "The Sean Connery Stage", size: "18,160 sqft" },
        ],
      },
      {
        name: "Pinewood South",
        stages: [
          { name: "Pinewood South Stage 1", size: "TBC" },
          { name: "Pinewood South Stage 2", size: "TBC" },
          { name: "Pinewood South Stage 3", size: "TBC" },
        ],
      },
    ],
  },
  {
    name: "Shepperton Studios",
    location: "Shepperton, Surrey",
    sections: [
      {
        name: "Original Lot — Netflix-Held",
        notes: "All 14 original stages leased to Netflix since 2019.",
        stages: [
          { name: "A Stage", size: "18,000 sqft", notes: "40ft height. Connects to B Stage. Netflix-held." },
          { name: "B Stage", size: "~16,000 sqft", notes: "Connects to A Stage. Netflix-held." },
          { name: "C Stage", size: "~14,000 sqft", notes: "Netflix-held." },
          { name: "D Stage", size: "~12,000 sqft", notes: "Netflix-held." },
          { name: "E Stage", size: "~12,000 sqft", notes: "Netflix-held." },
          { name: "F Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "G Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "H Stage", size: "30,000 sqft", notes: "45ft height. Largest original stage. Netflix-held." },
          { name: "I Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "J Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "K Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "L Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "M Stage", size: "~10,000 sqft", notes: "Netflix-held." },
          { name: "N Stage", size: "~10,000 sqft", notes: "Netflix-held." },
        ],
      },
      {
        name: "South Cluster",
        notes: "Amazon MGM (Stages 1–9) and Netflix (Stages 10–14). Opened 2023–2024.",
        stages: [
          { name: "South Stage 1", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 2", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 3", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 4", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 5", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 6", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 7", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 8", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 9", size: "Varies", notes: "Amazon MGM-held." },
          { name: "South Stage 10", size: "Varies", notes: "Netflix-held." },
          { name: "South Stage 11", size: "Varies", notes: "Netflix-held." },
          { name: "South Stage 12", size: "Varies", notes: "Netflix-held." },
          { name: "South Stage 13", size: "Varies", notes: "Netflix-held." },
          { name: "South Stage 14", size: "Varies", notes: "Netflix-held." },
        ],
      },
      {
        name: "Northwest Cluster",
        notes: "Netflix-held. 3 stages opened 2023–2024.",
        stages: [
          { name: "NW Stage 15", size: "Varies", notes: "Netflix-held." },
          { name: "NW Stage 16", size: "Varies", notes: "Netflix-held." },
          { name: "NW Stage 17", size: "Varies", notes: "Netflix-held." },
        ],
      },
    ],
  },
  {
    name: "Warner Bros. Studios Leavesden",
    location: "Leavesden, Watford, Hertfordshire",
    sections: [
      {
        name: "Production Stages — Original Factory Conversions",
        stages: [
          { name: "Stage A", size: "~20,000 sqft" },
          { name: "Stage B", size: "~20,000 sqft" },
          { name: "Stage C", size: "~20,000 sqft" },
          { name: "Stage D", size: "10,800 sqft", notes: "27ft height. Interior water tank." },
          { name: "Stage E", size: "~18,000 sqft" },
          { name: "Stage F", size: "~15,000 sqft" },
          { name: "Stage G", size: "~15,000 sqft" },
          { name: "Stage H", size: "~15,000 sqft" },
        ],
      },
      {
        name: "Production Stages — Newer Build",
        stages: [
          { name: "Stage L", size: "~18,000 sqft" },
          { name: "Stage T", size: "35,000 sqft", notes: "50ft height." },
          { name: "Stage U", size: "24,000 sqft", notes: "45ft height." },
          { name: "Stage V", size: "24,000 sqft", notes: "Virtual Production stage. LED volume." },
        ],
      },
      {
        name: "WB Studio Tour — Not For Hire",
        notes: "Harry Potter tour. Stages J, K, R are not available for production.",
        stages: [
          { name: "Stage J", size: "~25,000 sqft", notes: "Studio Tour only. Not for production hire." },
          { name: "Stage K", size: "~25,000 sqft", notes: "Studio Tour only. Not for production hire." },
          { name: "Stage R", size: "~20,000 sqft", notes: "Studio Tour only. Not for production hire." },
        ],
      },
    ],
  },
  {
    name: "Elstree Studios",
    location: "Shenley Road, Borehamwood, Hertfordshire",
    sections: [
      {
        name: "Main Studio",
        notes: "Original Elstree Studios. Not to be confused with Sky Studios Elstree.",
        stages: [
          { name: "George Lucas Stage 1", size: "15,770 sqft", notes: "Star Wars filmed here." },
          { name: "George Lucas Stage 2", size: "15,770 sqft" },
          { name: "Platinum Stage 3", size: "17,685 sqft", notes: "Opened 2022. Universal Production Services managed." },
          { name: "Platinum Stage 4", size: "17,685 sqft", notes: "Opened 2022. Universal Production Services managed." },
          { name: "Stage 5", size: "5,500 sqft", notes: "EastEnders permanent set." },
          { name: "Stage 6", size: "3,844 sqft", notes: "EastEnders permanent set." },
          { name: "Stage 7", size: "4,980 sqft", notes: "Reopened October 2025." },
          { name: "Stage 8", size: "7,550 sqft", notes: "EastEnders block booking until 2027." },
          { name: "Stage 9", size: "7,550 sqft", notes: "EastEnders block booking until 2027." },
          { name: "Exterior Lot", size: "N/A", notes: "Open-air filming area." },
        ],
      },
    ],
  },
  {
    name: "Sky Studios Elstree",
    location: "Rowleys Lane, Borehamwood, Hertfordshire",
    sections: [
      {
        name: "Main Studio",
        notes: "Separate from Elstree Studios. Purpose-built 2022. Operated by Universal Production Services.",
        stages: Array.from({ length: 12 }, (_, i) => ({
          name: `Stage ${i + 1}`,
          size: "~10,000–40,000 sqft",
        })).concat([{ name: "Backlot", size: "5 acres", notes: "Exterior filming space." }]),
      },
    ],
  },
  {
    name: "Longcross Studios",
    location: "North Longcross, Chertsey, Surrey",
    sections: [
      {
        name: "Main Studio",
        notes: "Netflix primary tenant. 200-acre backlot with vehicle test track.",
        stages: [
          { name: "Stage 1", size: "42,000–47,000 sqft", notes: "Largest stage. Netflix-primary." },
          { name: "Stage 2", size: "17,600–31,000 sqft" },
          { name: "Stage 3", size: "12,400–13,000 sqft" },
          { name: "Stage 4", size: "23,000–30,000 sqft", notes: "MegaNova. Added 2022." },
          { name: "Stage 5", size: "10,000–23,000 sqft", notes: "MegaNova. Added 2022." },
          { name: "Stage 6", size: "4,200–17,000 sqft", notes: "Formerly a helicopter chamber." },
          { name: "Tank", size: "N/A", notes: "Exterior water tank." },
          { name: "Test Track / Backlot", size: "200 acres", notes: "Former tank test track." },
        ],
      },
    ],
  },
  {
    name: "Longcross South Studios",
    location: "Longcross, Chertsey, Surrey",
    sections: [
      {
        name: "Main Studio",
        notes: "Separate from Longcross North. Independent. Planning until January 2028.",
        stages: [
          { name: "Stage A", size: "24,472 sqft" },
          { name: "Stage B", size: "29,435 sqft" },
          { name: "Stage C", size: "19,517 sqft" },
          { name: "Stage D", size: "19,517 sqft" },
          { name: "Stage E", size: "~36,000 sqft", notes: "Built to exceptional height for tall sets." },
          { name: "Space 1", size: "TBC" },
          { name: "Space 2", size: "TBC" },
          { name: "Space 3", size: "TBC" },
          { name: "Space 4", size: "TBC" },
        ],
      },
    ],
  },
  {
    name: "Shinfield Studios (Shadowbox Studios)",
    location: "Shinfield, Reading, Berkshire",
    sections: [
      {
        name: "Main Studio",
        notes: "Newest large-scale UK studio. 18 stages. Completed spring 2024.",
        stages: [
          { name: "Stage 1", size: "20,400 sqft", notes: "40ft height." },
          { name: "Stage 2", size: "~20,000 sqft" },
          { name: "Stage 3", size: "41,000 sqft", notes: "50ft height. One of two largest stages." },
          { name: "Stage 4", size: "~25,000 sqft" },
          { name: "Stage 5", size: "31,350 sqft", notes: "50ft height." },
          ...Array.from({ length: 13 }, (_, i) => ({
            name: `Stage ${i + 6}`,
            size: "17,000–43,000 sqft",
          })),
          { name: "Backlot", size: "9 acres" },
        ],
      },
    ],
  },
  {
    name: "3 Mills Studios",
    location: "Three Mills Island, Bow, East London",
    sections: [
      {
        name: "Main Studio",
        notes: "Historic island site. Strong TV, commercials, and smaller film base.",
        stages: [
          { name: "Stage 1", size: "~10,000 sqft" },
          { name: "Stage 2", size: "~9,000 sqft" },
          { name: "Stage 3", size: "~9,000 sqft" },
          { name: "Stage 4", size: "~8,500 sqft" },
          { name: "Stage 5", size: "~8,000 sqft" },
          { name: "Stage 6", size: "~8,000 sqft" },
          { name: "Stage 7", size: "~7,500 sqft" },
          { name: "Stage 8", size: "~7,500 sqft" },
          { name: "Stage 9", size: "~7,500 sqft" },
          { name: "Clock Mill", size: "Historic", notes: "Distinctive historic location/backdrop." },
          { name: "Floating Stage", size: "N/A", notes: "Moored alongside the island." },
        ],
      },
    ],
  },
  {
    name: "Ealing Studios",
    location: "Ealing Green, Ealing, London",
    sections: [
      {
        name: "Main Studio",
        notes: "World's oldest working film studio (est. 1902). New stage opened October 2025.",
        stages: [
          { name: "Stage 1 (Main Stage)", size: "~13,000 sqft", notes: "Historic primary stage." },
          { name: "Stage 2", size: "~8,000 sqft" },
          { name: "Stage 3", size: "~8,000 sqft" },
          { name: "New Stage", size: "14,000 sqft", notes: "Net-zero carbon. Completed October 2025." },
          { name: "Ealing Green (Backlot)", size: "N/A", notes: "Exterior shooting space." },
        ],
      },
    ],
  },
  {
    name: "Twickenham Film Studios",
    location: "St Margarets, Twickenham, Middlesex",
    sections: [
      {
        name: "Main Studio",
        notes: "Post-production specialist. Dolby Atmos certified.",
        stages: [
          { name: "Stage 1", size: "7,552 sqft", notes: "18ft height. Indoor water tank." },
          { name: "Stage 2", size: "2,000 sqft", notes: "23ft height." },
          { name: "Stage 3", size: "5,551 sqft", notes: "18ft height." },
          { name: "Post Production Theatre 1", size: "N/A", notes: "Dolby Atmos. 4K DCI." },
          { name: "Post Production Theatre 2", size: "N/A", notes: "4K DCI." },
          { name: "Post Production Theatre 3", size: "N/A", notes: "ADR and Foley." },
        ],
      },
    ],
  },
  {
    name: "Black Island Studios",
    location: "Park Royal, London",
    sections: [
      {
        name: "Main Studio",
        notes: "Commercial / TV / advertising focused. Drive-in access.",
        stages: [
          { name: "Stage 1", size: "9,750 sqft", notes: "Cyc wall. Drive-in access." },
          { name: "Stage 2", size: "5,850 sqft", notes: "25ft height. Cyc wall." },
          { name: "Stage 3", size: "6,500 sqft", notes: "26ft height. Cyc wall." },
          { name: "Stage 4", size: "2,208 sqft", notes: "Green screen cove. Arri Skypanels." },
          { name: "Stage 5", size: "16,500 sqft", notes: "Largest stage. Full drive-on access." },
        ],
      },
    ],
  },
  {
    name: "Garden Studios",
    location: "Park Royal, West London",
    sections: [
      {
        name: "Orchid Campus",
        notes: "Refurbished January 2025.",
        stages: [
          { name: "Orchid Stage 1", size: "15,026 sqft", notes: "9.9m height." },
          { name: "Orchid Stage 2", size: "12,863 sqft", notes: "9.9m height." },
          { name: "Orchid Stage 3", size: "7,187 sqft", notes: "9.6m height." },
        ],
      },
      {
        name: "Iris Campus",
        notes: "Home of the permanent LED virtual production wall (20m x 5m).",
        stages: [
          { name: "Iris Stage 1", size: "23,185 sqft", notes: "10.7m height. Permanent LED volume." },
          { name: "Iris Stage 2", size: "11,819 sqft", notes: "10.7m height." },
          { name: "Iris Stage 3", size: "5,005 sqft", notes: "10.7m height." },
          { name: "Lily Stage 3", size: "7,815 sqft", notes: "7.5m height." },
        ],
      },
      {
        name: "Rose Campus",
        notes: "Opened March 2025.",
        stages: [
          { name: "Rose Stage", size: "15,207 sqft", notes: "Opened March 2025." },
        ],
      },
    ],
  },
  {
    name: "Troubadour Meridian Water Studios",
    location: "Meridian Water, Edmonton, North London",
    sections: [
      {
        name: "Main Studio",
        stages: [
          { name: "Stage 1", size: "21,000 sqft", notes: "Soundproofed." },
          { name: "Stage 2", size: "11,200 sqft", notes: "Soundproofed." },
          { name: "Stage 3", size: "8,200 sqft", notes: "Intimate. Black box option." },
        ],
      },
    ],
  },
  {
    name: "The Bottle Yard Studios",
    location: "Whitchurch, Bristol",
    sections: [
      {
        name: "TBY1 — Main Site",
        notes: "Former bottling plant. BAFTA albert-accredited.",
        stages: [
          { name: "Tank House 1", size: "12,400 sqft", notes: "27ft height." },
          { name: "Tank House 2", size: "17,100 sqft", notes: "27ft height." },
          { name: "Tank House 3", size: "7,110 sqft", notes: "65ft height — exceptional ceiling." },
          { name: "Tank House 4", size: "21,700 sqft", notes: "24ft height. Largest on TBY1." },
          { name: "Export Warehouse 5", size: "15,950 sqft", notes: "27ft height." },
          { name: "Studio 6", size: "9,400 sqft", notes: "27ft height." },
          { name: "Studio 7", size: "18,350 sqft", notes: "27ft height." },
          { name: "Studio 8 (Green Screen)", size: "9,400 sqft", notes: "Dedicated green screen." },
        ],
      },
      {
        name: "TBY2 — Premium Facility",
        notes: "Purpose-built soundproofed stages. Opened 2022.",
        stages: [
          { name: "Studio 9", size: "20,000 sqft", notes: "Fully soundproofed." },
          { name: "Studio 10", size: "16,500 sqft", notes: "Fully soundproofed." },
          { name: "Studio 11", size: "7,000 sqft", notes: "Fully soundproofed." },
        ],
      },
    ],
  },
  {
    name: "Titanic Studios",
    location: "Titanic Quarter, Belfast, Northern Ireland",
    sections: [
      {
        name: "Main Studio",
        notes: "Former Harland & Wolff paint hall. Home of Game of Thrones.",
        stages: [
          { name: "Paint Hall Stage 1", size: "~26,000 sqft" },
          { name: "Paint Hall Stage 2", size: "~26,000 sqft" },
          { name: "Paint Hall Stage 3", size: "~26,000 sqft" },
          { name: "Paint Hall Stage 4", size: "~28,500 sqft" },
          { name: "William MacQuitty Stage", size: "~21,000 sqft", notes: "Purpose-built." },
          { name: "Brian Hurst Stage", size: "~21,000 sqft", notes: "Purpose-built." },
        ],
      },
    ],
  },
  {
    name: "Belfast Harbour Studios",
    location: "Titanic Quarter, Belfast, Northern Ireland",
    sections: [
      {
        name: "Main Studio",
        notes: "Two stages combinable into 64,000 sqft. Studio Ulster VP centre 2024.",
        stages: [
          { name: "Stage 1", size: "32,000 sqft", notes: "61ft eaves height. Combinable with Stage 2." },
          { name: "Stage 2", size: "32,000 sqft", notes: "61ft eaves height. Combinable with Stage 1." },
          { name: "Studio Ulster", size: "TBC", notes: "Virtual production centre. LED volume." },
        ],
      },
    ],
  },
];
