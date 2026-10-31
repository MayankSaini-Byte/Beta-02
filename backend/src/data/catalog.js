/**
 * KitchenSync grocery catalog.
 * price = INR per commercial unit (per kg for g-items, per L for ml-items, per pc for count items).
 * unit  = base unit used for stock quantities (g | ml | pc).
 * alternates = suggested substitute catalog keys.
 */
const CATALOG = [
  // ---------- Vegetables ----------
  { key: 'onion', name: 'Onion', category: 'vegetables', unit: 'g', price: 35, synonyms: ['pyaz', 'kanda', 'onions'], alternates: [], shelfLifeDays: 21 },
  { key: 'tomato', name: 'Tomato', category: 'vegetables', unit: 'g', price: 40, synonyms: ['tamatar', 'tomatoes'], alternates: ['tomato-ketchup'], shelfLifeDays: 7 },
  { key: 'potato', name: 'Potato', category: 'vegetables', unit: 'g', price: 30, synonyms: ['aloo', 'batata', 'potatoes'], alternates: ['sweet-potato'], shelfLifeDays: 21 },
  { key: 'sweet-potato', name: 'Sweet Potato', category: 'vegetables', unit: 'g', price: 55, synonyms: ['shakarkandi'], alternates: ['potato'], shelfLifeDays: 21 },
  { key: 'garlic', name: 'Garlic', category: 'vegetables', unit: 'g', price: 180, synonyms: ['lahsun'], alternates: ['ginger-garlic-paste'], shelfLifeDays: 30 },
  { key: 'ginger', name: 'Ginger', category: 'vegetables', unit: 'g', price: 120, synonyms: ['adrak'], alternates: ['ginger-garlic-paste'], shelfLifeDays: 14 },
  { key: 'green-chilli', name: 'Green Chilli', category: 'vegetables', unit: 'g', price: 80, synonyms: ['hari mirch', 'green chillies'], alternates: ['red-chilli-powder'], shelfLifeDays: 7 },
  { key: 'coriander-leaves', name: 'Coriander Leaves', category: 'vegetables', unit: 'g', price: 50, synonyms: ['dhaniya', 'cilantro', 'hara dhaniya'], alternates: ['kasuri-methi'], shelfLifeDays: 4 },
  { key: 'spinach', name: 'Spinach', category: 'vegetables', unit: 'g', price: 40, synonyms: ['palak'], alternates: ['methi-leaves'], shelfLifeDays: 3 },
  { key: 'methi-leaves', name: 'Fenugreek Leaves', category: 'vegetables', unit: 'g', price: 40, synonyms: ['methi'], alternates: ['kasuri-methi'], shelfLifeDays: 3 },
  { key: 'capsicum', name: 'Capsicum', category: 'vegetables', unit: 'g', price: 70, synonyms: ['shimla mirch', 'bell pepper'], alternates: [], shelfLifeDays: 10 },
  { key: 'cauliflower', name: 'Cauliflower', category: 'vegetables', unit: 'g', price: 45, synonyms: ['gobi', 'phool gobi'], alternates: [], shelfLifeDays: 7 },
  { key: 'cabbage', name: 'Cabbage', category: 'vegetables', unit: 'g', price: 32, synonyms: ['patta gobi', 'band gobi'], alternates: [], shelfLifeDays: 14 },
  { key: 'carrot', name: 'Carrot', category: 'vegetables', unit: 'g', price: 60, synonyms: ['gajar'], alternates: [], shelfLifeDays: 14 },
  { key: 'okra', name: 'Okra', category: 'vegetables', unit: 'g', price: 60, synonyms: ['bhindi', 'lady finger'], alternates: [], shelfLifeDays: 5 },
  { key: 'brinjal', name: 'Brinjal', category: 'vegetables', unit: 'g', price: 50, synonyms: ['baingan', 'eggplant', 'aubergine'], alternates: [], shelfLifeDays: 7 },
  { key: 'cucumber', name: 'Cucumber', category: 'vegetables', unit: 'g', price: 30, synonyms: ['kheera'], alternates: [], shelfLifeDays: 7 },
  { key: 'beetroot', name: 'Beetroot', category: 'vegetables', unit: 'g', price: 50, synonyms: ['chukandar'], alternates: [], shelfLifeDays: 14 },
  { key: 'lemon', name: 'Lemon', category: 'vegetables', unit: 'pc', price: 3, synonyms: ['nimbu', 'limbu'], alternates: ['vinegar'], shelfLifeDays: 14 },
  { key: 'peas', name: 'Green Peas (frozen)', category: 'frozen', unit: 'g', price: 120, synonyms: ['matar', 'green peas', 'frozen peas'], alternates: [], shelfLifeDays: 180 },

  // ---------- Fruits ----------
  { key: 'banana', name: 'Banana', category: 'fruits', unit: 'pc', price: 6, synonyms: ['kela'], alternates: [], shelfLifeDays: 5 },
  { key: 'apple', name: 'Apple', category: 'fruits', unit: 'g', price: 190, synonyms: ['seb'], alternates: [], shelfLifeDays: 21 },
  { key: 'orange', name: 'Orange', category: 'fruits', unit: 'g', price: 95, synonyms: ['santara', 'santra'], alternates: [], shelfLifeDays: 10 },
  { key: 'grapes', name: 'Grapes', category: 'fruits', unit: 'g', price: 110, synonyms: ['angoor'], alternates: [], shelfLifeDays: 6 },
  { key: 'papaya', name: 'Papaya', category: 'fruits', unit: 'g', price: 60, synonyms: ['papita'], alternates: [], shelfLifeDays: 6 },

  // ---------- Dairy ----------
  { key: 'milk', name: 'Milk', category: 'dairy', unit: 'ml', price: 66, synonyms: ['doodh', 'taaza milk', 'toned milk'], alternates: ['milk-powder'], shelfLifeDays: 3 },
  { key: 'curd', name: 'Curd / Yogurt', category: 'dairy', unit: 'g', price: 95, synonyms: ['dahi', 'yogurt'], alternates: [], shelfLifeDays: 7 },
  { key: 'paneer', name: 'Paneer', category: 'dairy', unit: 'g', price: 430, synonyms: ['cottage cheese', 'panir'], alternates: ['tofu'], shelfLifeDays: 7 },
  { key: 'tofu', name: 'Tofu', category: 'dairy', unit: 'g', price: 380, synonyms: ['soya paneer', 'bean curd'], alternates: ['paneer'], shelfLifeDays: 10 },
  { key: 'butter', name: 'Butter', category: 'dairy', unit: 'g', price: 570, synonyms: ['amul butter', 'makhan'], alternates: ['ghee'], shelfLifeDays: 60 },
  { key: 'ghee', name: 'Ghee', category: 'dairy', unit: 'ml', price: 640, synonyms: ['desi ghee', 'clarified butter'], alternates: ['butter', 'sunflower-oil'], shelfLifeDays: 180 },
  { key: 'cheese-slices', name: 'Cheese Slices', category: 'dairy', unit: 'g', price: 750, synonyms: ['cheese', 'amul cheese'], alternates: ['paneer'], shelfLifeDays: 60 },
  { key: 'cream', name: 'Fresh Cream', category: 'dairy', unit: 'ml', price: 300, synonyms: ['malai', 'cooking cream'], alternates: ['curd'], shelfLifeDays: 21 },
  { key: 'milk-powder', name: 'Milk Powder', category: 'dairy', unit: 'g', price: 520, synonyms: ['dairy whitener'], alternates: ['milk'], shelfLifeDays: 270 },

  // ---------- Grains & Flour ----------
  { key: 'wheat-flour', name: 'Whole Wheat Flour (Atta)', category: 'grains', unit: 'g', price: 55, synonyms: ['atta', 'gehu atta', 'flour'], alternates: [], shelfLifeDays: 120 },
  { key: 'rice', name: 'Rice', category: 'grains', unit: 'g', price: 75, synonyms: ['chawal', 'sona masoori'], alternates: ['basmati-rice'], shelfLifeDays: 240 },
  { key: 'basmati-rice', name: 'Basmati Rice', category: 'grains', unit: 'g', price: 130, synonyms: ['basmati chawal'], alternates: ['rice'], shelfLifeDays: 365 },
  { key: 'poha', name: 'Flattened Rice (Poha)', category: 'grains', unit: 'g', price: 65, synonyms: ['flattened rice', 'chiwda', 'aval'], alternates: [], shelfLifeDays: 120 },
  { key: 'sooji', name: 'Semolina (Sooji)', category: 'grains', unit: 'g', price: 55, synonyms: ['rava', 'semolina', 'suji'], alternates: [], shelfLifeDays: 120 },
  { key: 'besan', name: 'Gram Flour (Besan)', category: 'grains', unit: 'g', price: 115, synonyms: ['chickpea flour', 'besan'], alternates: [], shelfLifeDays: 150 },
  { key: 'bread', name: 'Bread', category: 'bakery', unit: 'pc', price: 45, synonyms: ['sandwich bread', 'paav bread'], alternates: ['pav'], shelfLifeDays: 5 },
  { key: 'pav', name: 'Pav', category: 'bakery', unit: 'pc', price: 8, synonyms: ['pao', 'ladi pav'], alternates: ['bread'], shelfLifeDays: 3 },
  { key: 'noodles', name: 'Maggi Noodles', category: 'packaged', unit: 'pc', price: 14, synonyms: ['maggi', 'instant noodles'], alternates: ['hakka-noodles'], shelfLifeDays: 120 },
  { key: 'hakka-noodles', name: 'Hakka Noodles', category: 'packaged', unit: 'g', price: 160, synonyms: ['chowmein noodles'], alternates: ['noodles'], shelfLifeDays: 240 },
  { key: 'pasta', name: 'Pasta (macaroni)', category: 'packaged', unit: 'pc', price: 90, synonyms: ['macaroni', 'penne'], alternates: ['hakka-noodles'], shelfLifeDays: 365 },
  { key: 'dosa-batter', name: 'Idli/Dosa Batter', category: 'packaged', unit: 'g', price: 90, synonyms: ['idli batter', 'dosa batter'], alternates: ['besan'], shelfLifeDays: 5 },

  // ---------- Pulses ----------
  { key: 'toor-dal', name: 'Toor Dal', category: 'pulses', unit: 'g', price: 165, synonyms: ['arhar dal', 'tur dal', 'pigeon pea'], alternates: ['moong-dal'], shelfLifeDays: 240 },
  { key: 'moong-dal', name: 'Moong Dal', category: 'pulses', unit: 'g', price: 145, synonyms: ['yellow moong', 'split moong'], alternates: ['toor-dal'], shelfLifeDays: 240 },
  { key: 'chana-dal', name: 'Chana Dal', category: 'pulses', unit: 'g', price: 115, synonyms: ['bengal gram split'], alternates: ['moong-dal'], shelfLifeDays: 240 },
  { key: 'urad-dal', name: 'Urad Dal', category: 'pulses', unit: 'g', price: 155, synonyms: ['black gram', 'udad dal'], alternates: ['moong-dal'], shelfLifeDays: 240 },
  { key: 'rajma', name: 'Rajma (kidney beans)', category: 'pulses', unit: 'g', price: 185, synonyms: ['kidney beans', 'rajma beans'], alternates: ['chickpeas'], shelfLifeDays: 240 },
  { key: 'chickpeas', name: 'Chickpeas (Chana)', category: 'pulses', unit: 'g', price: 120, synonyms: ['chana', 'kabuli chana', 'chole'], alternates: ['rajma'], shelfLifeDays: 240 },

  // ---------- Spices & Masalas ----------
  { key: 'turmeric', name: 'Turmeric Powder', category: 'spices', unit: 'g', price: 380, synonyms: ['haldi'], alternates: [], shelfLifeDays: 365 },
  { key: 'red-chilli-powder', name: 'Red Chilli Powder', category: 'spices', unit: 'g', price: 340, synonyms: ['lal mirch powder', 'chilli powder', 'mirchi powder'], alternates: ['green-chilli'], shelfLifeDays: 365 },
  { key: 'coriander-powder', name: 'Coriander Powder', category: 'spices', unit: 'g', price: 300, synonyms: ['dhania powder'], alternates: [], shelfLifeDays: 365 },
  { key: 'cumin', name: 'Cumin Seeds', category: 'spices', unit: 'g', price: 620, synonyms: ['jeera', 'zeera'], alternates: [], shelfLifeDays: 365 },
  { key: 'mustard-seeds', name: 'Mustard Seeds', category: 'spices', unit: 'g', price: 220, synonyms: ['rai', 'sarson', 'kadugu'], alternates: ['cumin'], shelfLifeDays: 365 },
  { key: 'garam-masala', name: 'Garam Masala', category: 'spices', unit: 'g', price: 720, synonyms: ['kitchen king', 'masala mix'], alternates: [], shelfLifeDays: 365 },
  { key: 'chaat-masala', name: 'Chaat Masala', category: 'spices', unit: 'g', price: 450, synonyms: ['chat masala'], alternates: [], shelfLifeDays: 365 },
  { key: 'kasuri-methi', name: 'Kasuri Methi', category: 'spices', unit: 'g', price: 420, synonyms: ['dried fenugreek leaves'], alternates: ['methi-leaves'], shelfLifeDays: 365 },
  { key: 'tamarind', name: 'Tamarind', category: 'spices', unit: 'g', price: 230, synonyms: ['imli'], alternates: ['lemon'], shelfLifeDays: 240 },
  { key: 'black-pepper', name: 'Black Pepper', category: 'spices', unit: 'g', price: 900, synonyms: ['kali mirch'], alternates: [], shelfLifeDays: 365 },
  { key: 'salt', name: 'Salt', category: 'spices', unit: 'g', price: 28, synonyms: ['namak', 'tata salt'], alternates: [], shelfLifeDays: 720 },
  { key: 'sugar', name: 'Sugar', category: 'spices', unit: 'g', price: 46, synonyms: ['cheeni', 'shakkar'], alternates: ['jaggery'], shelfLifeDays: 720 },
  { key: 'jaggery', name: 'Jaggery', category: 'spices', unit: 'g', price: 70, synonyms: ['gud', 'gur'], alternates: ['sugar'], shelfLifeDays: 240 },

  // ---------- Oils & Condiments ----------
  { key: 'sunflower-oil', name: 'Sunflower Oil', category: 'oils-condiments', unit: 'ml', price: 145, synonyms: ['refined oil', 'cooking oil', 'tel'], alternates: ['ghee'], shelfLifeDays: 270 },
  { key: 'ginger-garlic-paste', name: 'Ginger Garlic Paste', category: 'oils-condiments', unit: 'g', price: 190, synonyms: ['adrak lehsun paste'], alternates: ['ginger', 'garlic'], shelfLifeDays: 30 },
  { key: 'soy-sauce', name: 'Soy Sauce', category: 'oils-condiments', unit: 'ml', price: 220, synonyms: ['soya sauce'], alternates: [], shelfLifeDays: 365 },
  { key: 'vinegar', name: 'Vinegar', category: 'oils-condiments', unit: 'ml', price: 60, synonyms: ['sirka'], alternates: ['lemon'], shelfLifeDays: 365 },
  { key: 'tomato-ketchup', name: 'Tomato Ketchup', category: 'oils-condiments', unit: 'g', price: 130, synonyms: ['ketchup', 'sauce'], alternates: [], shelfLifeDays: 270 },

  // ---------- Protein & Others ----------
  { key: 'egg', name: 'Eggs', category: 'protein', unit: 'pc', price: 7, synonyms: ['anda', 'eggs'], alternates: [], shelfLifeDays: 21 },
  { key: 'chicken', name: 'Chicken (curry cut)', category: 'protein', unit: 'g', price: 320, synonyms: ['murgh', 'chicken curry cut'], alternates: ['soya-chunks'], shelfLifeDays: 2 },
  { key: 'soya-chunks', name: 'Soya Chunks', category: 'protein', unit: 'g', price: 160, synonyms: ['nutrela', 'meal maker'], alternates: ['chicken'], shelfLifeDays: 365 },
  { key: 'cashew', name: 'Cashew Nuts', category: 'other', unit: 'g', price: 900, synonyms: ['kaju', 'cashews'], alternates: ['peanuts'], shelfLifeDays: 240 },
  { key: 'peanuts', name: 'Peanuts', category: 'other', unit: 'g', price: 145, synonyms: ['moongphali', 'groundnut'], alternates: ['cashew'], shelfLifeDays: 150 },
  { key: 'mushroom', name: 'Mushroom', category: 'vegetables', unit: 'g', price: 160, synonyms: ['khumbi', 'button mushroom'], alternates: [], shelfLifeDays: 5 },
  { key: 'sweet-corn', name: 'Sweet Corn', category: 'frozen', unit: 'g', price: 120, synonyms: ['corn kernels'], alternates: ['peas'], shelfLifeDays: 180 },

  // ---------- Beverages ----------
  { key: 'tea-leaves', name: 'Tea Leaves', category: 'beverages', unit: 'g', price: 480, synonyms: ['chai patti', 'black tea'], alternates: ['coffee'], shelfLifeDays: 365 },
  { key: 'coffee', name: 'Coffee Powder', category: 'beverages', unit: 'g', price: 850, synonyms: ['nescafe', 'filter coffee'], alternates: ['tea-leaves'], shelfLifeDays: 365 },

  // ---------- Added for gym / expanded library ----------
  { key: 'oats', name: 'Rolled Oats', category: 'grains', unit: 'g', price: 180, synonyms: ['oatmeal', 'rolled oats'], alternates: ['poha'], shelfLifeDays: 365 },
  { key: 'honey', name: 'Honey', category: 'other', unit: 'g', price: 650, synonyms: ['shahad'], alternates: ['sugar'], shelfLifeDays: 900 },
  { key: 'fish', name: 'Rohu Fish (cleaned)', category: 'protein', unit: 'g', price: 400, synonyms: ['rohu', 'fish curry cut'], alternates: ['chicken'], shelfLifeDays: 2 },
  { key: 'black-pepper', name: 'Black Pepper Powder', category: 'spices', unit: 'g', price: 850, synonyms: ['kali mirch', 'pepper powder'], alternates: ['garam-masala'], shelfLifeDays: 720 },
  { key: 'mint', name: 'Mint Leaves', category: 'vegetables', unit: 'g', price: 40, synonyms: ['pudina'], alternates: ['kasuri-methi'], shelfLifeDays: 4 },
  { key: 'curry-leaves', name: 'Curry Leaves', category: 'vegetables', unit: 'g', price: 20, synonyms: ['kadhi patta', 'curry patta'], alternates: ['kasuri-methi'], shelfLifeDays: 5 },
  { key: 'mustard-oil', name: 'Mustard Oil', category: 'oils-condiments', unit: 'ml', price: 190, synonyms: ['sarson ka tel', 'kachi ghani oil'], alternates: ['sunflower-oil'], shelfLifeDays: 365 },
  { key: 'cornflour', name: 'Cornflour', category: 'packaged', unit: 'g', price: 120, synonyms: ['corn starch'], alternates: ['besan'], shelfLifeDays: 540 }
];


module.exports = CATALOG;
