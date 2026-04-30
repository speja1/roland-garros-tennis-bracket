(function () {
  const menSeeds = [
    "J. Sinner", "C. Alcaraz", "A. Zverev", "T. Fritz", "J. Draper", "N. Djokovic", "C. Ruud", "L. Musetti",
    "A. de Minaur", "H. Rune", "D. Medvedev", "T. Paul", "B. Shelton", "A. Fils", "F. Tiafoe", "G. Dimitrov",
    "A. Rublev", "F. Cerundolo", "J. Mensik", "S. Tsitsipas", "T. Machac", "U. Humbert", "S. Korda", "K. Khachanov",
    "A. Popyrin", "A. Davidovich Fokina", "D. Shapovalov", "B. Nakashima", "F. Auger-Aliassime", "H. Hurkacz", "G. Mpetshi Perricard", "A. Michelsen"
  ];

  const menFloaters = [
    "R. Gasquet", "J. Lehecka", "J. Thompson", "P. Llamas Ruiz", "L. Harris", "M. Marterer", "A. Walton", "J. Munar",
    "N. Jarry", "L. Djere", "A. Bublik", "J. Duckworth", "N. Basilashvili", "H. Rocha", "A. Muller", "J. Fonseca",
    "P. Herbert", "B. Bonzi", "G. Monfils", "H. Dellien", "M. Bellucci", "L. Tien", "J. de Jong", "F. Passaro",
    "M. Cilic", "F. Cobolli", "M. Arnaldi", "G. Diallo", "M. Giron", "T. Griekspoor", "A. Shevchenko", "D. Lajovic",
    "E. Quinn", "C. Norrie", "A. Kovacevic", "F. Gomez", "J. Fearnley", "S. Wawrinka", "C. O'Connell", "P. Martinez",
    "F. Misolic", "Y. Bu", "C. Moutet", "C. Tabur", "M. McDonald", "Y. Hanfmann", "V. Royer", "D. Galan",
    "R. Opelka", "R. Hijikata", "M. Navone", "Q. Halys", "M. Kecmanovic", "S. Baez", "E. Nava", "B. Van De Zandschulp",
    "R. Bautista Agut", "R. Safiullin", "P. Carreno Busta", "F. Comesana", "J. Brooksby", "J. Faria", "L. Darderi", "J. Cerundolo",
    "K. Majchrzak", "H. Medjedovic", "V. Kopriva", "T. Monteiro", "D. Altmaier", "A. Ramos-Vinolas", "K. Jacquet", "N. Borges",
    "A. Tabilo", "A. Cazaux", "Y. Nishioka", "A. Vukic", "S. Ofner", "J. Struff", "M. Fucsovics", "T. Schoolkate",
    "E. Moller", "L. Sonego", "H. Gaston", "U. Blanchet", "B. Hassan", "M. Gigante", "T. Etcheverry", "Z. Bergs",
    "T. Tirante", "D. Dzumhur", "F. Marozsan", "L. Nardi", "G. Zeppieri", "T. Atmane", "C. Ugo Carabelli", "M. Berrettini"
  ];

  const womenSeeds = [
    "A. Sabalenka", "C. Gauff", "J. Pegula", "I. Swiatek", "M. Keys", "M. Andreeva", "Q. Zheng", "E. Navarro",
    "P. Badosa", "E. Rybakina", "D. Kasatkina", "D. Collins", "B. Haddad Maia", "E. Svitolina", "K. Muchova", "A. Anisimova",
    "M. Kostyuk", "L. Samsonova", "V. Azarenka", "D. Vekic", "M. Bouzkova", "Y. Putintseva", "L. Noskova", "M. Sakkari",
    "M. Vondrousova", "L. Fernandez", "E. Alexandrova", "S. Kenin", "E. Mertens", "A. Kalinskaya", "V. Kudermetova", "C. Garcia"
  ];

  const womenFloaters = [
    "N. Osaka", "B. Andreescu", "S. Stephens", "E. Raducanu", "D. Shnaider", "A. Potapova", "V. Gracheva", "C. Burel",
    "A. Tomljanovic", "T. Townsend", "P. Martic", "M. Trevisan", "A. Rus", "A. Blinkova", "C. Dolehide", "K. Volynets",
    "M. Frech", "C. Tauson", "Y. Yuan", "X. Wang", "V. Tomova", "M. Sherif", "A. Bogdan", "R. Zarazua",
    "G. Minnen", "S. Cirstea", "L. Bronzetti", "K. Boulter", "J. Paolini", "T. Maria", "A. Krueger", "M. Linette",
    "L. Siegemund", "P. Kvitova", "J. Teichmann", "H. Dart", "M. Uchijima", "C. Osorio", "A. Sasnovich", "K. Pliskova",
    "D. Parry", "A. Parks", "E. Cocciaretto", "A. Bondar", "R. Masarova", "A. Cornet", "T. Korpatsch", "B. Krejcikova",
    "L. Fruhvirtova", "B. Bencic", "M. Joint", "R. Sramkova", "S. Sorribes Tormo", "P. Stearns", "A. Li", "M. Carle",
    "J. Niemeier", "Y. Starodubtseva", "C. Bucsa", "E. Avanesyan", "S. Errani", "C. Paquet", "K. Birrell", "A. Riske-Amritraj",
    "A. Danilovic", "A. Schmiedlova", "L. Sun", "O. Gadecki", "E. Andreeva", "S. Kartal", "T. Valentova", "M. Bouzas Maneiro",
    "A. Fruhvirtova", "L. Pigossi", "J. Cristian", "M. Timofeeva", "R. Marino", "K. Rakhimova", "L. Jeanjean", "D. Saville",
    "P. Hon", "A. Sevastova", "J. Fett", "N. Podoroska", "M. Brengle", "S. Waltert", "T. Zidansek", "Y. Wickmayer",
    "M. Bassols Ribera", "A. Eala", "S. Bejlek", "M. Stakusic", "K. Siniakova", "D. Galfi", "T. Babos", "M. Bjorklund"
  ];

  function seededSlots(seeds, floaters, eventCode) {
    const names = [];
    const pairs = seeds.map((seedName, index) => [seedName, floaters[index]]);
    const remaining = floaters.slice(seeds.length);
    pairs.forEach((pair) => names.push(pair[0], pair[1]));
    remaining.forEach((name) => names.push(name));

    return names.slice(0, 128).map((name, slotIndex) => {
      const seed = seeds.indexOf(name) + 1;
      return {
        id: `${eventCode}-P${String(slotIndex + 1).padStart(3, "0")}`,
        name,
        seed: seed > 0 ? seed : null,
        slotIndex
      };
    });
  }

  window.RG_SAMPLE_DRAWS = {
    MS: {
      eventCode: "MS",
      name: "Men's Singles",
      source: "sample",
      sourceUrl: "sample-data",
      players: seededSlots(menSeeds, menFloaters, "MS")
    },
    WS: {
      eventCode: "WS",
      name: "Women's Singles",
      source: "sample",
      sourceUrl: "sample-data",
      players: seededSlots(womenSeeds, womenFloaters, "WS")
    }
  };
})();
