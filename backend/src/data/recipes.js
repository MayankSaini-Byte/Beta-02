/**
 * KitchenSync recipe library - 38 real Indian household recipes (veg / egg / non-veg / gym).
 * Ingredient quantities are for `baseServings` people. The API scales them
 * to the user's household (adults = 1.0 portion, children = 0.5 portion).
 * `yt` = YouTube search query (always resolves to real, current videos).
 */
const RECIPES = [
  {
    key: 'poha',
    name: 'Kanda Poha',
    cuisine: 'Maharashtrian', diet: 'veg', meal: ['breakfast'], timeMin: 20, baseServings: 2, kcal: 290,
    taste: ['light', 'comfort'], tags: ['quick', 'everyday'], rating: 4.6,
    ingredients: [
      { key: 'poha', qty: 200, unit: 'g' }, { key: 'onion', qty: 100, unit: 'g' },
      { key: 'potato', qty: 100, unit: 'g' }, { key: 'peanuts', qty: 30, unit: 'g' },
      { key: 'mustard-seeds', qty: 5, unit: 'g' }, { key: 'cumin', qty: 5, unit: 'g' },
      { key: 'turmeric', qty: 3, unit: 'g' }, { key: 'green-chilli', qty: 10, unit: 'g' },
      { key: 'lemon', qty: 1, unit: 'pc' }, { key: 'coriander-leaves', qty: 15, unit: 'g' },
      { key: 'sunflower-oil', qty: 20, unit: 'ml' }, { key: 'sugar', qty: 5, unit: 'g' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Rinse poha in a colander until soft, drain and keep aside (do not soak).',
      'Heat oil, crackle mustard seeds and cumin, then fry peanuts till golden and remove.',
      'Saute onions and green chillies till translucent, add diced potato with a splash of water, cover and cook till soft.',
      'Add turmeric, salt and sugar, then fold in the softened poha gently.',
      'Switch off, squeeze lemon juice, top with peanuts and chopped coriander.'
    ],
    yt: 'kanda poha recipe'
  },
  {
    key: 'aloo-paratha',
    name: 'Aloo Paratha',
    cuisine: 'North Indian', diet: 'veg', meal: ['breakfast'], timeMin: 35, baseServings: 2, kcal: 420,
    taste: ['comfort'], tags: ['punjabi', 'kids-favourite'], rating: 4.8,
    ingredients: [
      { key: 'wheat-flour', qty: 300, unit: 'g' }, { key: 'potato', qty: 350, unit: 'g' },
      { key: 'onion', qty: 60, unit: 'g' }, { key: 'green-chilli', qty: 8, unit: 'g' },
      { key: 'coriander-leaves', qty: 15, unit: 'g' }, { key: 'ghee', qty: 30, unit: 'ml' },
      { key: 'red-chilli-powder', qty: 5, unit: 'g' }, { key: 'garam-masala', qty: 4, unit: 'g' },
      { key: 'salt', qty: 6, unit: 'g' }, { key: 'curd', qty: 150, unit: 'g' }
    ],
    steps: [
      'Knead a soft dough with wheat flour, water and a little salt; rest for 20 minutes.',
      'Mix mashed boiled potatoes, finely chopped onion, chillies, coriander and the dry masalas.',
      'Roll a dough ball, stuff with the aloo mix, seal and roll out gently.',
      'Roast on a hot tawa with ghee on both sides till golden brown spots appear.',
      'Serve hot with curd or pickle.'
    ],
    yt: 'aloo paratha recipe'
  },
  {
    key: 'masala-dosa',
    name: 'Masala Dosa',
    cuisine: 'South Indian', diet: 'veg', meal: ['breakfast'], timeMin: 30, baseServings: 2, kcal: 350,
    taste: ['light'], tags: ['south-indian', 'weekend'], rating: 4.7,
    ingredients: [
      { key: 'dosa-batter', qty: 400, unit: 'g' }, { key: 'potato', qty: 300, unit: 'g' },
      { key: 'onion', qty: 100, unit: 'g' }, { key: 'mustard-seeds', qty: 5, unit: 'g' },
      { key: 'cumin', qty: 4, unit: 'g' }, { key: 'turmeric', qty: 3, unit: 'g' },
      { key: 'green-chilli', qty: 10, unit: 'g' }, { key: 'ginger', qty: 10, unit: 'g' },
      { key: 'sunflower-oil', qty: 25, unit: 'ml' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Boil and lightly mash potatoes with turmeric and salt.',
      'Temper mustard seeds and cumin in oil; saute onion, ginger and green chillies.',
      'Add the mashed potato with a splash of water to make a moist bharta.',
      'Spread a ladle of batter thin on a hot griddle, drizzle oil and crisp it.',
      'Place the potato filling inside, fold and serve with sambar and chutney.'
    ],
    yt: 'masala dosa recipe hotel style'
  },
  {
    key: 'upma',
    name: 'Vegetable Upma',
    cuisine: 'South Indian', diet: 'veg', meal: ['breakfast'], timeMin: 25, baseServings: 2, kcal: 300,
    taste: ['light', 'comfort'], tags: ['quick'], rating: 4.3,
    ingredients: [
      { key: 'sooji', qty: 180, unit: 'g' }, { key: 'onion', qty: 80, unit: 'g' },
      { key: 'carrot', qty: 60, unit: 'g' }, { key: 'peas', qty: 50, unit: 'g' },
      { key: 'mustard-seeds', qty: 5, unit: 'g' }, { key: 'green-chilli', qty: 8, unit: 'g' },
      { key: 'ginger', qty: 10, unit: 'g' }, { key: 'ghee', qty: 20, unit: 'ml' },
      { key: 'lemon', qty: 1, unit: 'pc' }, { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Dry roast sooji till lightly fragrant and keep aside.',
      'Heat ghee, crackle mustard seeds, saute onion, ginger, chillies and vegetables.',
      'Add 2.5 cups hot water and salt; bring to a boil.',
      'Rain in the roasted sooji stirring continuously to avoid lumps.',
      'Cover and steam 3 minutes, finish with lemon and coriander.'
    ],
    yt: 'upma recipe'
  },
  {
    key: 'dal-tadka',
    name: 'Dal Tadka',
    cuisine: 'North Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 30, baseServings: 3, kcal: 320,
    taste: ['comfort'], tags: ['everyday', 'high-protein'], rating: 4.7,
    ingredients: [
      { key: 'toor-dal', qty: 250, unit: 'g' }, { key: 'turmeric', qty: 5, unit: 'g' },
      { key: 'tomato', qty: 120, unit: 'g' }, { key: 'onion', qty: 80, unit: 'g' },
      { key: 'cumin', qty: 5, unit: 'g' }, { key: 'mustard-seeds', qty: 4, unit: 'g' },
      { key: 'red-chilli-powder', qty: 6, unit: 'g' }, { key: 'garlic', qty: 15, unit: 'g' },
      { key: 'ghee', qty: 25, unit: 'ml' }, { key: 'coriander-leaves', qty: 15, unit: 'g' }, { key: 'salt', qty: 6, unit: 'g' }
    ],
    steps: [
      'Pressure cook toor dal with turmeric, chopped tomato and water till soft; whisk smooth.',
      'Heat ghee; crackle cumin and mustard seeds, then fry sliced garlic till golden.',
      'Add onions and cook till pink, then red chilli powder for the tadka.',
      'Pour the sizzling tadka over the dal, add salt and simmer 5 minutes.',
      'Garnish with coriander and serve with rice or roti.'
    ],
    yt: 'dal tadka recipe'
  },
  {
    key: 'rajma-masala',
    name: 'Rajma Masala',
    cuisine: 'North Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 50, baseServings: 3, kcal: 380,
    taste: ['spicy', 'comfort'], tags: ['high-protein', 'punjabi'], rating: 4.8,
    ingredients: [
      { key: 'rajma', qty: 250, unit: 'g' }, { key: 'onion', qty: 150, unit: 'g' },
      { key: 'tomato', qty: 200, unit: 'g' }, { key: 'garlic', qty: 20, unit: 'g' },
      { key: 'ginger', qty: 15, unit: 'g' }, { key: 'coriander-powder', qty: 8, unit: 'g' },
      { key: 'red-chilli-powder', qty: 7, unit: 'g' }, { key: 'garam-masala', qty: 5, unit: 'g' },
      { key: 'sunflower-oil', qty: 25, unit: 'ml' }, { key: 'salt', qty: 6, unit: 'g' }, { key: 'rice', qty: 300, unit: 'g' }
    ],
    steps: [
      'Soak rajma overnight and pressure cook with salt till completely soft.',
      'Fry onions in oil till deep golden; add ginger-garlic and cook off the rawness.',
      'Add tomato puree and dry masalas; bhunao till oil separates.',
      'Add cooked rajma with some stock; simmer 20 minutes till gravy thickens.',
      'Serve with steamed rice.'
    ],
    yt: 'rajma recipe punjabi'
  },
  {
    key: 'chole',
    name: 'Punjabi Chole',
    cuisine: 'North Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 45, baseServings: 3, kcal: 360,
    taste: ['spicy'], tags: ['high-protein'], rating: 4.6,
    ingredients: [
      { key: 'chickpeas', qty: 250, unit: 'g' }, { key: 'onion', qty: 150, unit: 'g' },
      { key: 'tomato', qty: 180, unit: 'g' }, { key: 'ginger', qty: 15, unit: 'g' },
      { key: 'garlic', qty: 15, unit: 'g' }, { key: 'green-chilli', qty: 8, unit: 'g' },
      { key: 'garam-masala', qty: 8, unit: 'g' }, { key: 'coriander-powder', qty: 8, unit: 'g' },
      { key: 'red-chilli-powder', qty: 6, unit: 'g' }, { key: 'sunflower-oil', qty: 25, unit: 'ml' },
      { key: 'tea-leaves', qty: 5, unit: 'g' }, { key: 'salt', qty: 6, unit: 'g' }
    ],
    steps: [
      'Soak chickpeas overnight; pressure cook with a small tied pouch of tea leaves for colour.',
      'Saute onions till brown; add ginger, garlic, chillies and tomato puree.',
      'Cook the masala till oil separates, add dry spices.',
      'Add boiled chole with stock; simmer 15-20 minutes and lightly mash a few for body.',
      'Finish with ginger juliennes and coriander.'
    ],
    yt: 'chole recipe punjabi'
  },
  {
    key: 'paneer-butter-masala',
    name: 'Paneer Butter Masala',
    cuisine: 'North Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 40, baseServings: 2, kcal: 520,
    taste: ['rich'], tags: ['restaurant-style', 'kids-favourite'], rating: 4.9,
    ingredients: [
      { key: 'paneer', qty: 250, unit: 'g' }, { key: 'tomato', qty: 350, unit: 'g' },
      { key: 'butter', qty: 40, unit: 'g' }, { key: 'cream', qty: 60, unit: 'ml' },
      { key: 'cashew', qty: 30, unit: 'g' }, { key: 'garam-masala', qty: 6, unit: 'g' },
      { key: 'red-chilli-powder', qty: 5, unit: 'g' }, { key: 'kasuri-methi', qty: 4, unit: 'g' },
      { key: 'sugar', qty: 5, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }, { key: 'ginger', qty: 10, unit: 'g' }
    ],
    steps: [
      'Blanch tomatoes; blend with soaked cashews into a smooth puree.',
      'Melt butter, add the puree and ginger paste; cook 10 minutes till thick and glossy.',
      'Season with chilli powder, garam masala, sugar and salt.',
      'Add paneer cubes and cream; simmer 3-4 minutes.',
      'Crush kasuri methi on top and serve with naan or rice.'
    ],
    yt: 'paneer butter masala recipe'
  },
  {
    key: 'palak-paneer',
    name: 'Palak Paneer',
    cuisine: 'North Indian', diet: 'veg', meal: ['dinner'], timeMin: 35, baseServings: 2, kcal: 400,
    taste: ['mild'], tags: ['healthy', 'iron-rich'], rating: 4.5,
    ingredients: [
      { key: 'spinach', qty: 300, unit: 'g' }, { key: 'paneer', qty: 200, unit: 'g' },
      { key: 'onion', qty: 100, unit: 'g' }, { key: 'tomato', qty: 100, unit: 'g' },
      { key: 'garlic', qty: 15, unit: 'g' }, { key: 'green-chilli', qty: 8, unit: 'g' },
      { key: 'cumin', qty: 4, unit: 'g' }, { key: 'cream', qty: 30, unit: 'ml' },
      { key: 'sunflower-oil', qty: 20, unit: 'ml' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Blanch spinach 2 minutes in boiling water, shock in ice water and blend smooth (keeps it green).',
      'Temper cumin in oil; saute onion, garlic and chillies till soft.',
      'Add chopped tomato and cook till mushy.',
      'Add spinach puree and salt; simmer 5 minutes on low.',
      'Fold in paneer cubes and cream; serve with roti or jeera rice.'
    ],
    yt: 'palak paneer recipe'
  },
  {
    key: 'aloo-gobhi',
    name: 'Aloo Gobhi',
    cuisine: 'North Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 30, baseServings: 2, kcal: 310,
    taste: ['spicy'], tags: ['everyday', 'dry'], rating: 4.4,
    ingredients: [
      { key: 'potato', qty: 250, unit: 'g' }, { key: 'cauliflower', qty: 300, unit: 'g' },
      { key: 'cumin', qty: 5, unit: 'g' }, { key: 'turmeric', qty: 4, unit: 'g' },
      { key: 'red-chilli-powder', qty: 6, unit: 'g' }, { key: 'coriander-powder', qty: 8, unit: 'g' },
      { key: 'ginger', qty: 10, unit: 'g' }, { key: 'sunflower-oil', qty: 25, unit: 'ml' },
      { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Heat oil, crackle cumin and add ginger.',
      'Add potato cubes; fry 4-5 minutes till edges brown.',
      'Add cauliflower florets, turmeric, chilli and coriander powder; toss well.',
      'Cover on low heat 10-12 minutes, stirring once, till both are cooked.',
      'Finish with coriander leaves and a squeeze of lemon.'
    ],
    yt: 'aloo gobhi recipe'
  },
  {
    key: 'bhindi-masala',
    name: 'Bhindi Masala',
    cuisine: 'North Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 25, baseServings: 2, kcal: 280,
    taste: ['spicy'], tags: ['everyday', 'dry'], rating: 4.3,
    ingredients: [
      { key: 'okra', qty: 350, unit: 'g' }, { key: 'onion', qty: 100, unit: 'g' },
      { key: 'tomato', qty: 100, unit: 'g' }, { key: 'turmeric', qty: 3, unit: 'g' },
      { key: 'coriander-powder', qty: 8, unit: 'g' }, { key: 'red-chilli-powder', qty: 5, unit: 'g' },
      { key: 'garam-masala', qty: 3, unit: 'g' }, { key: 'sunflower-oil', qty: 30, unit: 'ml' },
      { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Wash and completely dry okra, cut into 1-inch pieces (dry okra = no slime).',
      'Shallow fry okra in oil till browned and remove.',
      'In the same pan cook onions, then tomatoes with all spices.',
      'Return okra; toss and cook 5 minutes on high.',
      'Serve hot with phulka.'
    ],
    yt: 'bhindi masala recipe'
  },
  {
    key: 'veg-pulao',
    name: 'Vegetable Pulao',
    cuisine: 'Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 35, baseServings: 3, kcal: 380,
    taste: ['mild'], tags: ['one-pot'], rating: 4.4,
    ingredients: [
      { key: 'basmati-rice', qty: 300, unit: 'g' }, { key: 'carrot', qty: 80, unit: 'g' },
      { key: 'peas', qty: 80, unit: 'g' }, { key: 'capsicum', qty: 80, unit: 'g' },
      { key: 'onion', qty: 100, unit: 'g' }, { key: 'cumin', qty: 6, unit: 'g' },
      { key: 'garam-masala', qty: 5, unit: 'g' }, { key: 'ghee', qty: 25, unit: 'ml' },
      { key: 'salt', qty: 6, unit: 'g' }
    ],
    steps: [
      'Soak basmati rice 20 minutes and drain.',
      'Heat ghee, crackle cumin, saute onions and all vegetables.',
      'Add garam masala and salt, then the rice; gently toast 2 minutes.',
      'Add 1.5x water, bring to boil, cover and dum on low 12 minutes.',
      'Fluff with a fork and serve with raita.'
    ],
    yt: 'veg pulao recipe'
  },
  {
    key: 'veg-biryani',
    name: 'Veg Biryani',
    cuisine: 'Hyderabadi', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 70, baseServings: 4, kcal: 520,
    taste: ['rich', 'spicy'], tags: ['weekend', 'party'], rating: 4.8,
    ingredients: [
      { key: 'basmati-rice', qty: 400, unit: 'g' }, { key: 'potato', qty: 150, unit: 'g' },
      { key: 'carrot', qty: 100, unit: 'g' }, { key: 'cauliflower', qty: 120, unit: 'g' },
      { key: 'peas', qty: 80, unit: 'g' }, { key: 'onion', qty: 150, unit: 'g' },
      { key: 'curd', qty: 150, unit: 'g' }, { key: 'garam-masala', qty: 10, unit: 'g' },
      { key: 'red-chilli-powder', qty: 8, unit: 'g' }, { key: 'turmeric', qty: 4, unit: 'g' },
      { key: 'ghee', qty: 40, unit: 'ml' }, { key: 'coriander-leaves', qty: 20, unit: 'g' }, { key: 'salt', qty: 8, unit: 'g' }
    ],
    steps: [
      'Parboil basmati rice with whole spices till 70% done; drain.',
      'Fry onions crisp; saute all vegetables with curd and masalas to make the gravy.',
      'Layer gravy and rice alternately in a heavy pot, topping with fried onions and coriander.',
      'Seal with foil or dough; dum on lowest heat 20 minutes.',
      'Rest 10 minutes, then open and serve with raita.'
    ],
    yt: 'veg biryani recipe'
  },
  {
    key: 'khichdi',
    name: 'Moong Dal Khichdi',
    cuisine: 'Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 30, baseServings: 2, kcal: 320,
    taste: ['comfort', 'mild'], tags: ['healthy', 'one-pot', 'sick-day'], rating: 4.5,
    ingredients: [
      { key: 'rice', qty: 150, unit: 'g' }, { key: 'moong-dal', qty: 100, unit: 'g' },
      { key: 'turmeric', qty: 4, unit: 'g' }, { key: 'cumin', qty: 5, unit: 'g' },
      { key: 'ghee', qty: 20, unit: 'ml' }, { key: 'onion', qty: 60, unit: 'g' },
      { key: 'tomato', qty: 80, unit: 'g' }, { key: 'green-chilli', qty: 5, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Wash rice and moong dal together; soak 10 minutes.',
      'Pressure cook with turmeric, salt and 3.5x water till very soft.',
      'Temper cumin in ghee; saute onion, chilli and tomato.',
      'Pour the tempering over khichdi, mix and adjust consistency.',
      'Serve warm with ghee, papad and curd.'
    ],
    yt: 'dal khichdi recipe'
  },
  {
    key: 'pav-bhaji',
    name: 'Mumbai Pav Bhaji',
    cuisine: 'Mumbai street food', diet: 'veg', meal: ['dinner'], timeMin: 45, baseServings: 3, kcal: 480,
    taste: ['spicy', 'rich'], tags: ['street-food', 'kids-favourite'], rating: 4.9,
    ingredients: [
      { key: 'potato', qty: 400, unit: 'g' }, { key: 'tomato', qty: 300, unit: 'g' },
      { key: 'onion', qty: 150, unit: 'g' }, { key: 'capsicum', qty: 100, unit: 'g' },
      { key: 'peas', qty: 80, unit: 'g' }, { key: 'pav', qty: 6, unit: 'pc' },
      { key: 'butter', qty: 50, unit: 'g' }, { key: 'garam-masala', qty: 8, unit: 'g' },
      { key: 'red-chilli-powder', qty: 10, unit: 'g' }, { key: 'turmeric', qty: 4, unit: 'g' },
      { key: 'lemon', qty: 1, unit: 'pc' }, { key: 'coriander-leaves', qty: 15, unit: 'g' }, { key: 'salt', qty: 7, unit: 'g' }
    ],
    steps: [
      'Pressure cook potatoes and peas till soft; mash roughly.',
      'Melt half the butter; fry onions and capsicum, add tomato puree and cook till dark.',
      'Add all masalas and the mashed vegetables with a splash of water; simmer 15 minutes, mashing as you go.',
      'Finish with remaining butter and coriander; squeeze lemon.',
      'Slit pavs, toast on tawa with butter, and serve with the bhaji.'
    ],
    yt: 'pav bhaji recipe mumbai style'
  },
  {
    key: 'masala-maggi',
    name: 'Masala Maggi',
    cuisine: 'Indian', diet: 'veg', meal: ['snack'], timeMin: 12, baseServings: 1, kcal: 350,
    taste: ['comfort', 'spicy'], tags: ['quick', 'midnight', 'hostel'], rating: 4.7,
    ingredients: [
      { key: 'noodles', qty: 2, unit: 'pc' }, { key: 'onion', qty: 50, unit: 'g' },
      { key: 'tomato', qty: 60, unit: 'g' }, { key: 'capsicum', qty: 50, unit: 'g' },
      { key: 'green-chilli', qty: 5, unit: 'g' }, { key: 'butter', qty: 10, unit: 'g' },
      { key: 'turmeric', qty: 2, unit: 'g' }, { key: 'red-chilli-powder', qty: 3, unit: 'g' }
    ],
    steps: [
      'Melt butter; saute onion, chilli and capsicum 2 minutes on high.',
      'Add tomato and masalas; cook till soft.',
      'Pour 1.5 cups water and the tastemaker; boil.',
      'Add noodles and cook 2 minutes till water is absorbed.',
      'Top with cheese if you have it. Midnight sorted.'
    ],
    yt: 'masala maggi recipe'
  },
  {
    key: 'grilled-sandwich',
    name: 'Grilled Veg Cheese Sandwich',
    cuisine: 'Continental', diet: 'veg', meal: ['snack', 'breakfast'], timeMin: 15, baseServings: 1, kcal: 380,
    taste: ['mild'], tags: ['quick', 'kids-favourite'], rating: 4.5,
    ingredients: [
      { key: 'bread', qty: 4, unit: 'pc' }, { key: 'capsicum', qty: 50, unit: 'g' },
      { key: 'tomato', qty: 60, unit: 'g' }, { key: 'onion', qty: 40, unit: 'g' },
      { key: 'cheese-slices', qty: 40, unit: 'g' }, { key: 'butter', qty: 15, unit: 'g' },
      { key: 'chaat-masala', qty: 2, unit: 'g' }, { key: 'green-chilli', qty: 4, unit: 'g' }
    ],
    steps: [
      'Butter the bread slices on the outside.',
      'Layer onion, tomato, capsicum, chilli and cheese between slices; sprinkle chaat masala.',
      'Grill in a sandwich maker or pan till golden and the cheese melts.',
      'Cut diagonally and serve with ketchup.'
    ],
    yt: 'veg cheese sandwich recipe'
  },
  {
    key: 'curd-rice',
    name: 'South Indian Curd Rice',
    cuisine: 'South Indian', diet: 'veg', meal: ['lunch'], timeMin: 20, baseServings: 2, kcal: 300,
    taste: ['light', 'comfort'], tags: ['quick', 'summer'], rating: 4.4,
    ingredients: [
      { key: 'rice', qty: 200, unit: 'g' }, { key: 'curd', qty: 300, unit: 'g' },
      { key: 'mustard-seeds', qty: 5, unit: 'g' }, { key: 'cumin', qty: 3, unit: 'g' },
      { key: 'green-chilli', qty: 5, unit: 'g' }, { key: 'ginger', qty: 8, unit: 'g' },
      { key: 'ghee', qty: 15, unit: 'ml' }, { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Cook rice soft and let it cool to room temperature.',
      'Mash lightly and mix in curd and salt to a creamy consistency.',
      'Temper mustard seeds, cumin, ginger and chilli in ghee.',
      'Pour the tempering over the curd rice; mix.',
      'Garnish with coriander; serve chilled or fresh.'
    ],
    yt: 'curd rice recipe'
  },
  {
    key: 'hakka-noodles',
    name: 'Veg Hakka Noodles',
    cuisine: 'Indo-Chinese', diet: 'veg', meal: ['dinner', 'snack'], timeMin: 25, baseServings: 2, kcal: 420,
    taste: ['spicy'], tags: ['indo-chinese', 'quick'], rating: 4.4,
    ingredients: [
      { key: 'hakka-noodles', qty: 200, unit: 'g' }, { key: 'capsicum', qty: 80, unit: 'g' },
      { key: 'carrot', qty: 80, unit: 'g' }, { key: 'cabbage', qty: 80, unit: 'g' },
      { key: 'onion', qty: 80, unit: 'g' }, { key: 'soy-sauce', qty: 20, unit: 'ml' },
      { key: 'vinegar', qty: 10, unit: 'ml' }, { key: 'green-chilli', qty: 6, unit: 'g' },
      { key: 'sunflower-oil', qty: 25, unit: 'ml' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Boil noodles till just done, rinse cold and toss with a little oil.',
      'Heat oil on high flame; stir-fry onions and chillies.',
      'Add julienned vegetables; toss 2 minutes keeping them crunchy.',
      'Add noodles, soy sauce, vinegar and salt; toss on high heat 2 minutes.',
      'Serve hot with schezwan chutney.'
    ],
    yt: 'veg hakka noodles recipe'
  },
  {
    key: 'tomato-rasam',
    name: 'Tomato Rasam',
    cuisine: 'South Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 25, baseServings: 3, kcal: 150,
    taste: ['tangy', 'spicy'], tags: ['healthy', 'sick-day'], rating: 4.3,
    ingredients: [
      { key: 'tomato', qty: 200, unit: 'g' }, { key: 'tamarind', qty: 30, unit: 'g' },
      { key: 'turmeric', qty: 3, unit: 'g' }, { key: 'cumin', qty: 5, unit: 'g' },
      { key: 'mustard-seeds', qty: 4, unit: 'g' }, { key: 'garlic', qty: 10, unit: 'g' },
      { key: 'red-chilli-powder', qty: 5, unit: 'g' }, { key: 'ghee', qty: 10, unit: 'ml' },
      { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Soak tamarind in warm water and extract pulp.',
      'Crush tomatoes; simmer with tamarind water, turmeric, chilli powder and salt for 10 minutes.',
      'Lightly crush cumin and garlic; add to the rasam and simmer till frothy.',
      'Temper mustard seeds in ghee and pour over.',
      'Garnish with coriander; serve hot with rice or sip as soup.'
    ],
    yt: 'tomato rasam recipe'
  },
  {
    key: 'egg-bhurji',
    name: 'Masala Egg Bhurji',
    cuisine: 'North Indian', diet: 'egg', meal: ['breakfast', 'dinner'], timeMin: 15, baseServings: 2, kcal: 320,
    taste: ['spicy'], tags: ['quick', 'high-protein'], rating: 4.5,
    ingredients: [
      { key: 'egg', qty: 4, unit: 'pc' }, { key: 'onion', qty: 80, unit: 'g' },
      { key: 'tomato', qty: 80, unit: 'g' }, { key: 'green-chilli', qty: 6, unit: 'g' },
      { key: 'turmeric', qty: 3, unit: 'g' }, { key: 'red-chilli-powder', qty: 4, unit: 'g' },
      { key: 'garam-masala', qty: 3, unit: 'g' }, { key: 'sunflower-oil', qty: 15, unit: 'ml' },
      { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Saute onion and chilli till golden; add tomato and spices.',
      'Cook till tomato is mushy and oil shows at the edges.',
      'Beat eggs with salt; pour in and stir on low-medium heat.',
      'Scramble softly - do not overcook; they keep cooking off heat.',
      'Finish with coriander and serve with pav or toast.'
    ],
    yt: 'egg bhurji recipe'
  },
  {
    key: 'chicken-curry',
    name: 'Home Style Chicken Curry',
    cuisine: 'Indian', diet: 'nonveg', meal: ['lunch', 'dinner'], timeMin: 50, baseServings: 3, kcal: 450,
    taste: ['spicy', 'rich'], tags: ['weekend'], rating: 4.7,
    ingredients: [
      { key: 'chicken', qty: 600, unit: 'g' }, { key: 'onion', qty: 200, unit: 'g' },
      { key: 'tomato', qty: 200, unit: 'g' }, { key: 'ginger-garlic-paste', qty: 30, unit: 'g' },
      { key: 'curd', qty: 100, unit: 'g' }, { key: 'turmeric', qty: 4, unit: 'g' },
      { key: 'coriander-powder', qty: 10, unit: 'g' }, { key: 'red-chilli-powder', qty: 8, unit: 'g' },
      { key: 'garam-masala', qty: 6, unit: 'g' }, { key: 'sunflower-oil', qty: 30, unit: 'ml' },
      { key: 'coriander-leaves', qty: 15, unit: 'g' }, { key: 'salt', qty: 7, unit: 'g' }
    ],
    steps: [
      'Marinate chicken with curd, turmeric, chilli powder and salt for 30 minutes.',
      'Brown onions well in oil; add ginger-garlic paste and cook 2 minutes.',
      'Add tomato puree and dry spices; bhunao till oil separates.',
      'Add chicken and sear 5 minutes, then simmer covered 25 minutes with a splash of water.',
      'Finish with garam masala and coriander; rest 5 minutes before serving.'
    ],
    yt: 'chicken curry recipe indian'
  },
  {
    key: 'masala-chai',
    name: 'Adrak Masala Chai',
    cuisine: 'Indian', diet: 'veg', meal: ['snack'], timeMin: 10, baseServings: 2, kcal: 90,
    taste: ['comfort'], tags: ['quick', 'monsoon'], rating: 4.9,
    ingredients: [
      { key: 'tea-leaves', qty: 8, unit: 'g' }, { key: 'milk', qty: 300, unit: 'ml' },
      { key: 'ginger', qty: 10, unit: 'g' }, { key: 'sugar', qty: 10, unit: 'g' }
    ],
    steps: [
      'Crush ginger coarsely.',
      'Boil water with ginger for 2 minutes to release the flavour.',
      'Add tea leaves and simmer 1 minute.',
      'Add milk and sugar; bring to a rolling boil twice.',
      'Strain into cups and enjoy with biscuits.'
    ],
    yt: 'masala chai recipe'
  },

  // ==================== EGG SECTION ====================
  {
    key: 'egg-curry',
    name: 'Masala Egg Curry',
    cuisine: 'North Indian', diet: 'egg', meal: ['lunch', 'dinner'], timeMin: 30, baseServings: 2, kcal: 380,
    taste: ['spicy', 'comfort'], tags: ['high-protein', 'everyday'], rating: 4.6,
    nutrition: { protein: 19, carbs: 18, fat: 24, fiber: 4 },
    ingredients: [
      { key: 'egg', qty: 4, unit: 'pc' }, { key: 'onion', qty: 150, unit: 'g' },
      { key: 'tomato', qty: 200, unit: 'g' }, { key: 'ginger-garlic-paste', qty: 15, unit: 'g' },
      { key: 'turmeric', qty: 3, unit: 'g' }, { key: 'red-chilli-powder', qty: 6, unit: 'g' },
      { key: 'coriander-powder', qty: 8, unit: 'g' }, { key: 'garam-masala', qty: 4, unit: 'g' },
      { key: 'sunflower-oil', qty: 20, unit: 'ml' }, { key: 'coriander-leaves', qty: 10, unit: 'g' },
      { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Boil eggs 8 minutes, peel and make light slits; pan-sear with a pinch of turmeric.',
      'Fry onions till golden, add ginger-garlic paste and tomato; cook till mushy.',
      'Add dry masalas and a splash of water; simmer 8 minutes into a thick gravy.',
      'Slip in the eggs, coat with gravy and simmer 5 minutes.',
      'Finish with garam masala and coriander; serve with rice or roti.'
    ],
    yt: 'egg curry recipe'
  },
  {
    key: 'egg-fried-rice',
    name: 'Egg Fried Rice',
    cuisine: 'Indo-Chinese', diet: 'egg', meal: ['lunch', 'dinner'], timeMin: 25, baseServings: 2, kcal: 460,
    taste: ['spicy'], tags: ['quick', 'leftover-rice'], rating: 4.5,
    nutrition: { protein: 15, carbs: 62, fat: 15, fiber: 3 },
    ingredients: [
      { key: 'rice', qty: 250, unit: 'g' }, { key: 'egg', qty: 3, unit: 'pc' },
      { key: 'capsicum', qty: 80, unit: 'g' }, { key: 'carrot', qty: 80, unit: 'g' },
      { key: 'cabbage', qty: 80, unit: 'g' }, { key: 'soy-sauce', qty: 20, unit: 'ml' },
      { key: 'vinegar', qty: 10, unit: 'ml' }, { key: 'sunflower-oil', qty: 25, unit: 'ml' },
      { key: 'green-chilli', qty: 8, unit: 'g' }, { key: 'black-pepper', qty: 2, unit: 'g' },
      { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Cook rice, spread to cool (day-old rice works best).',
      'Scramble eggs with salt in a hot wok; remove.',
      'Stir-fry capsicum, carrot and cabbage on high heat 2 minutes.',
      'Add rice, soy sauce, vinegar and pepper; toss till coated and steaming.',
      'Fold in the eggs and spring onion greens; serve hot.'
    ],
    yt: 'egg fried rice recipe'
  },
  {
    key: 'besan-egg-chilla',
    name: 'Besan Egg Chilla',
    cuisine: 'Indian', diet: 'egg', meal: ['breakfast'], timeMin: 20, baseServings: 2, kcal: 320,
    taste: ['light', 'spicy'], tags: ['high-protein', 'quick', 'gym'], rating: 4.4,
    nutrition: { protein: 17, carbs: 30, fat: 13, fiber: 5 },
    ingredients: [
      { key: 'besan', qty: 150, unit: 'g' }, { key: 'egg', qty: 2, unit: 'pc' },
      { key: 'onion', qty: 60, unit: 'g' }, { key: 'tomato', qty: 60, unit: 'g' },
      { key: 'green-chilli', qty: 6, unit: 'g' }, { key: 'coriander-leaves', qty: 10, unit: 'g' },
      { key: 'red-chilli-powder', qty: 3, unit: 'g' }, { key: 'turmeric', qty: 2, unit: 'g' },
      { key: 'sunflower-oil', qty: 15, unit: 'ml' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Whisk besan, eggs, chopped vegetables, masalas and water into a smooth pouring batter.',
      'Rest 10 minutes so the besan hydrates.',
      'Pour ladlefuls on a greased tawa; spread thin.',
      'Cook till golden on both sides with a little oil.',
      'Serve with green chutney or curd.'
    ],
    yt: 'besan chilla recipe'
  },

  // ==================== NON-VEG SECTION ====================
  {
    key: 'butter-chicken',
    name: 'Easy Butter Chicken',
    cuisine: 'North Indian', diet: 'nonveg', meal: ['dinner'], timeMin: 45, baseServings: 2, kcal: 560,
    taste: ['rich', 'comfort'], tags: ['weekend', 'restaurant-style'], rating: 4.9,
    nutrition: { protein: 34, carbs: 14, fat: 38, fiber: 2 },
    ingredients: [
      { key: 'chicken', qty: 500, unit: 'g' }, { key: 'curd', qty: 100, unit: 'g' },
      { key: 'tomato', qty: 300, unit: 'g' }, { key: 'cream', qty: 60, unit: 'ml' },
      { key: 'butter', qty: 40, unit: 'g' }, { key: 'ginger-garlic-paste', qty: 20, unit: 'g' },
      { key: 'garam-masala', qty: 6, unit: 'g' }, { key: 'red-chilli-powder', qty: 6, unit: 'g' },
      { key: 'kasuri-methi', qty: 3, unit: 'g' }, { key: 'salt', qty: 6, unit: 'g' }
    ],
    steps: [
      'Marinate chicken in curd, ginger-garlic paste, chilli powder and salt for 30 minutes.',
      'Sear the chicken in butter till charred at the edges; keep aside.',
      'Blend boiled tomatoes smooth; simmer with butter for 10 minutes.',
      'Add chicken, garam masala and kasuri methi; cook 12 minutes.',
      'Stir in cream, rest 3 minutes and serve with naan or rice.'
    ],
    yt: 'butter chicken recipe'
  },
  {
    key: 'chicken-biryani',
    name: 'Pressure Cooker Chicken Biryani',
    cuisine: 'Hyderabadi', diet: 'nonveg', meal: ['lunch', 'dinner'], timeMin: 55, baseServings: 2, kcal: 640,
    taste: ['rich', 'spicy'], tags: ['weekend', 'one-pot'], rating: 4.8,
    nutrition: { protein: 30, carbs: 68, fat: 26, fiber: 4 },
    ingredients: [
      { key: 'chicken', qty: 450, unit: 'g' }, { key: 'basmati-rice', qty: 300, unit: 'g' },
      { key: 'curd', qty: 120, unit: 'g' }, { key: 'onion', qty: 150, unit: 'g' },
      { key: 'tomato', qty: 100, unit: 'g' }, { key: 'ghee', qty: 30, unit: 'ml' },
      { key: 'ginger-garlic-paste', qty: 20, unit: 'g' }, { key: 'garam-masala', qty: 8, unit: 'g' },
      { key: 'red-chilli-powder', qty: 8, unit: 'g' }, { key: 'turmeric', qty: 3, unit: 'g' },
      { key: 'mint', qty: 10, unit: 'g' }, { key: 'coriander-leaves', qty: 15, unit: 'g' },
      { key: 'salt', qty: 8, unit: 'g' }
    ],
    steps: [
      'Marinate chicken with curd, masalas and ginger-garlic paste for 30 minutes.',
      'Fry onions in ghee till deep golden; reserve half for layering.',
      'Cook the marinated chicken in the same pot till 80% done.',
      'Layer soaked basmati rice, mint, coriander and fried onions over the chicken.',
      'Seal and pressure cook 2 whistles on low; rest 10 minutes before opening.'
    ],
    yt: 'chicken biryani recipe'
  },
  {
    key: 'pepper-chicken',
    name: 'Kerala Pepper Chicken',
    cuisine: 'South Indian', diet: 'nonveg', meal: ['dinner'], timeMin: 40, baseServings: 2, kcal: 430,
    taste: ['spicy'], tags: ['high-protein', 'gym'], rating: 4.7,
    nutrition: { protein: 36, carbs: 10, fat: 25, fiber: 2 },
    ingredients: [
      { key: 'chicken', qty: 500, unit: 'g' }, { key: 'black-pepper', qty: 6, unit: 'g' },
      { key: 'onion', qty: 120, unit: 'g' }, { key: 'curry-leaves', qty: 8, unit: 'g' },
      { key: 'ginger-garlic-paste', qty: 18, unit: 'g' }, { key: 'turmeric', qty: 3, unit: 'g' },
      { key: 'coriander-powder', qty: 8, unit: 'g' }, { key: 'sunflower-oil', qty: 25, unit: 'ml' },
      { key: 'green-chilli', qty: 8, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Shallow-cook chicken with turmeric and salt till done; keep aside.',
      'Fry onions, curry leaves and green chillies till soft.',
      'Add ginger-garlic paste and crushed black pepper; bloom 1 minute.',
      'Toss in the chicken; roast on high till the masala clings and edges char.',
      'Finish with a crack of pepper and curry leaf tempering.'
    ],
    yt: 'kerala pepper chicken recipe'
  },
  {
    key: 'fish-curry',
    name: 'Bengali Fish Curry (Macher Jhol)',
    cuisine: 'Bengali', diet: 'nonveg', meal: ['lunch', 'dinner'], timeMin: 35, baseServings: 2, kcal: 390,
    taste: ['light', 'spicy'], tags: ['everyday'], rating: 4.6,
    nutrition: { protein: 28, carbs: 12, fat: 24, fiber: 2 },
    ingredients: [
      { key: 'fish', qty: 400, unit: 'g' }, { key: 'potato', qty: 150, unit: 'g' },
      { key: 'tomato', qty: 150, unit: 'g' }, { key: 'onion', qty: 80, unit: 'g' },
      { key: 'turmeric', qty: 5, unit: 'g' }, { key: 'red-chilli-powder', qty: 5, unit: 'g' },
      { key: 'mustard-seeds', qty: 4, unit: 'g' }, { key: 'mustard-oil', qty: 30, unit: 'ml' },
      { key: 'green-chilli', qty: 6, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Rub fish with turmeric and salt; shallow-fry in mustard oil till golden.',
      'Fry potato wedges in the same oil; remove.',
      'Crackle mustard seeds, fry onion and tomato into a masala base.',
      'Add water, turmeric and chilli; boil, then slide in fish and potato.',
      'Simmer 10 minutes till the gravy coats a spoon; serve with rice.'
    ],
    yt: 'bengali fish curry recipe'
  },

  // ==================== VEG ADDITIONS ====================
  {
    key: 'besan-chilla',
    name: 'Besan Chilla',
    cuisine: 'North Indian', diet: 'veg', meal: ['breakfast'], timeMin: 20, baseServings: 2, kcal: 280,
    taste: ['light'], tags: ['quick', 'high-protein'], rating: 4.4,
    nutrition: { protein: 12, carbs: 34, fat: 10, fiber: 6 },
    ingredients: [
      { key: 'besan', qty: 150, unit: 'g' }, { key: 'onion', qty: 60, unit: 'g' },
      { key: 'tomato', qty: 60, unit: 'g' }, { key: 'capsicum', qty: 40, unit: 'g' },
      { key: 'green-chilli', qty: 6, unit: 'g' }, { key: 'coriander-leaves', qty: 10, unit: 'g' },
      { key: 'turmeric', qty: 2, unit: 'g' }, { key: 'red-chilli-powder', qty: 3, unit: 'g' },
      { key: 'sunflower-oil', qty: 15, unit: 'ml' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Whisk besan with water to a smooth, pourable batter; rest 10 minutes.',
      'Fold in chopped onion, tomato, capsicum, chilli and masalas.',
      'Spread ladlefuls thin on a greased tawa.',
      'Cook till crisp and golden on both sides.',
      'Serve hot with chutney.'
    ],
    yt: 'besan chilla recipe'
  },
  {
    key: 'mushroom-masala',
    name: 'Mushroom Masala',
    cuisine: 'Indian', diet: 'veg', meal: ['dinner'], timeMin: 30, baseServings: 2, kcal: 340,
    taste: ['spicy', 'rich'], tags: ['everyday'], rating: 4.5,
    nutrition: { protein: 11, carbs: 20, fat: 22, fiber: 4 },
    ingredients: [
      { key: 'mushroom', qty: 300, unit: 'g' }, { key: 'onion', qty: 120, unit: 'g' },
      { key: 'tomato', qty: 150, unit: 'g' }, { key: 'ginger-garlic-paste', qty: 12, unit: 'g' },
      { key: 'coriander-powder', qty: 8, unit: 'g' }, { key: 'red-chilli-powder', qty: 5, unit: 'g' },
      { key: 'garam-masala', qty: 4, unit: 'g' }, { key: 'sunflower-oil', qty: 20, unit: 'ml' },
      { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Saute mushrooms on high heat till they release water and brown; remove.',
      'Fry onions, add ginger-garlic paste and tomato; cook to a masala.',
      'Add dry spices and a splash of water; simmer 5 minutes.',
      'Return mushrooms; cook 6 minutes till the gravy clings.',
      'Finish with garam masala and coriander.'
    ],
    yt: 'mushroom masala recipe'
  },
  {
    key: 'veg-manchurian',
    name: 'Veg Manchurian',
    cuisine: 'Indo-Chinese', diet: 'veg', meal: ['dinner'], timeMin: 40, baseServings: 2, kcal: 420,
    taste: ['spicy', 'rich'], tags: ['weekend'], rating: 4.5,
    nutrition: { protein: 9, carbs: 48, fat: 20, fiber: 5 },
    ingredients: [
      { key: 'cabbage', qty: 150, unit: 'g' }, { key: 'carrot', qty: 100, unit: 'g' },
      { key: 'capsicum', qty: 80, unit: 'g' }, { key: 'onion', qty: 80, unit: 'g' },
      { key: 'cornflour', qty: 60, unit: 'g' }, { key: 'soy-sauce', qty: 25, unit: 'ml' },
      { key: 'vinegar', qty: 10, unit: 'ml' }, { key: 'tomato-ketchup', qty: 30, unit: 'g' },
      { key: 'garlic', qty: 15, unit: 'g' }, { key: 'green-chilli', qty: 8, unit: 'g' },
      { key: 'sunflower-oil', qty: 200, unit: 'ml' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Grate cabbage, carrot, capsicum; squeeze out water and mix with cornflour, salt and soy sauce.',
      'Shape firm balls; deep-fry till golden and crisp.',
      'Fry garlic and chilli; add soy sauce, ketchup, vinegar and a little water.',
      'Toss the balls in the sauce on high heat for 1 minute.',
      'Garnish with spring onion and serve immediately.'
    ],
    yt: 'veg manchurian recipe'
  },

  // ==================== GYM / HIGH-PROTEIN ====================
  {
    key: 'soya-masala',
    name: 'Masala Soya Chunks',
    cuisine: 'Indian', diet: 'veg', meal: ['lunch', 'dinner'], timeMin: 30, baseServings: 2, kcal: 400,
    taste: ['spicy', 'comfort'], tags: ['gym', 'high-protein', 'meatless'], rating: 4.6,
    nutrition: { protein: 36, carbs: 30, fat: 14, fiber: 9 },
    ingredients: [
      { key: 'soya-chunks', qty: 120, unit: 'g' }, { key: 'onion', qty: 120, unit: 'g' },
      { key: 'tomato', qty: 180, unit: 'g' }, { key: 'ginger-garlic-paste', qty: 12, unit: 'g' },
      { key: 'turmeric', qty: 3, unit: 'g' }, { key: 'red-chilli-powder', qty: 6, unit: 'g' },
      { key: 'coriander-powder', qty: 8, unit: 'g' }, { key: 'garam-masala', qty: 4, unit: 'g' },
      { key: 'curd', qty: 60, unit: 'g' }, { key: 'sunflower-oil', qty: 20, unit: 'ml' },
      { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 5, unit: 'g' }
    ],
    steps: [
      'Boil soya chunks 8 minutes, squeeze dry and rough-chop the big ones.',
      'Fry onions till golden; add ginger-garlic paste and tomato masala.',
      'Beat curd smooth and stir in with the dry masalas; cook till oil separates.',
      'Add soya chunks and simmer 8 minutes so they drink the masala.',
      'Rest 5 minutes off heat - it gets better as it sits.'
    ],
    yt: 'soya chunks curry recipe'
  },
  {
    key: 'chicken-tandoori',
    name: 'Tandoori-Style Grilled Chicken',
    cuisine: 'Punjabi', diet: 'nonveg', meal: ['dinner'], timeMin: 45, baseServings: 2, kcal: 380,
    taste: ['spicy', 'smoky'], tags: ['gym', 'high-protein', 'low-carb'], rating: 4.8,
    nutrition: { protein: 42, carbs: 8, fat: 18, fiber: 1 },
    ingredients: [
      { key: 'chicken', qty: 500, unit: 'g' }, { key: 'curd', qty: 150, unit: 'g' },
      { key: 'ginger-garlic-paste', qty: 25, unit: 'g' }, { key: 'red-chilli-powder', qty: 10, unit: 'g' },
      { key: 'garam-masala', qty: 6, unit: 'g' }, { key: 'turmeric', qty: 3, unit: 'g' },
      { key: 'lemon', qty: 1, unit: 'pc' }, { key: 'sunflower-oil', qty: 15, unit: 'ml' },
      { key: 'salt', qty: 6, unit: 'g' }
    ],
    steps: [
      'Score chicken pieces; rub with lemon, salt and ginger-garlic paste.',
      'Marinate 4+ hours (or 30 minutes minimum) in spiced hung curd.',
      'Grill or pan-roast on medium-high, basting once, till charred and cooked through.',
      'Rest 5 minutes, then squeeze fresh lemon over.',
      'Serve with sliced onion and green chutney.'
    ],
    yt: 'tandoori chicken recipe'
  },
  {
    key: 'protein-salad',
    name: 'Sprouts & Paneer Protein Bowl',
    cuisine: 'Modern Indian', diet: 'veg', meal: ['snack', 'lunch'], timeMin: 15, baseServings: 2, kcal: 330,
    taste: ['light'], tags: ['gym', 'high-protein', 'no-cook'], rating: 4.4,
    nutrition: { protein: 24, carbs: 22, fat: 14, fiber: 8 },
    ingredients: [
      { key: 'moong-dal', qty: 120, unit: 'g' }, { key: 'paneer', qty: 150, unit: 'g' },
      { key: 'cucumber', qty: 100, unit: 'g' }, { key: 'carrot', qty: 80, unit: 'g' },
      { key: 'tomato', qty: 80, unit: 'g' }, { key: 'peanuts', qty: 25, unit: 'g' },
      { key: 'lemon', qty: 1, unit: 'pc' }, { key: 'black-pepper', qty: 2, unit: 'g' },
      { key: 'salt', qty: 3, unit: 'g' }
    ],
    steps: [
      'Steam or boil sprouted moong 5 minutes till just tender; cool.',
      'Cube and lightly sear paneer in a dry pan.',
      'Chop cucumber, carrot and tomato into a big bowl.',
      'Toss everything with lemon juice, salt and crushed pepper.',
      'Top with roasted peanuts for crunch.'
    ],
    yt: 'sprouts protein salad recipe'
  },
  {
    key: 'protein-oats',
    name: 'Peanut Banana Protein Oats',
    cuisine: 'Modern Indian', diet: 'veg', meal: ['breakfast'], timeMin: 10, baseServings: 2, kcal: 380,
    taste: ['sweet'], tags: ['gym', 'high-protein', 'quick'], rating: 4.5,
    nutrition: { protein: 16, carbs: 48, fat: 14, fiber: 7 },
    ingredients: [
      { key: 'oats', qty: 90, unit: 'g' }, { key: 'milk', qty: 400, unit: 'ml' },
      { key: 'banana', qty: 2, unit: 'pc' }, { key: 'peanuts', qty: 30, unit: 'g' },
      { key: 'honey', qty: 15, unit: 'g' }, { key: 'salt', qty: 1, unit: 'g' }
    ],
    steps: [
      'Roast peanuts in a dry pan till fragrant; crush roughly.',
      'Simmer oats in milk 5 minutes till creamy.',
      'Slice in the banana; stir half through the oats.',
      'Sweeten with honey and a pinch of salt to pop the flavour.',
      'Top with the rest of the banana and crushed peanuts.'
    ],
    yt: 'protein oats recipe'
  },
  {
    key: 'paneer-bhurji-hp',
    name: 'High-Protein Paneer Bhurji',
    cuisine: 'North Indian', diet: 'veg', meal: ['breakfast'], timeMin: 20, baseServings: 2, kcal: 420,
    taste: ['spicy', 'comfort'], tags: ['gym', 'high-protein', 'quick'], rating: 4.7,
    nutrition: { protein: 26, carbs: 14, fat: 28, fiber: 3 },
    ingredients: [
      { key: 'paneer', qty: 250, unit: 'g' }, { key: 'onion', qty: 100, unit: 'g' },
      { key: 'tomato', qty: 120, unit: 'g' }, { key: 'capsicum', qty: 60, unit: 'g' },
      { key: 'turmeric', qty: 3, unit: 'g' }, { key: 'red-chilli-powder', qty: 5, unit: 'g' },
      { key: 'garam-masala', qty: 3, unit: 'g' }, { key: 'ghee', qty: 15, unit: 'ml' },
      { key: 'coriander-leaves', qty: 10, unit: 'g' }, { key: 'salt', qty: 4, unit: 'g' }
    ],
    steps: [
      'Crumble paneer coarse with your hands.',
      'Fry onion in ghee till edges brown; add capsicum.',
      'Add tomato and masalas; cook till glossy.',
      'Fold in the paneer crumble; cook just 3 minutes so it stays soft.',
      'Finish with coriander; serve with roti or stuff into a paratha.'
    ],
    yt: 'paneer bhurji recipe'
  }
];

// Merge per-serving nutrition for library recipes that predate the nutrition field.
const NUTRITION = require('./nutrition');
for (const r of RECIPES) {
  if (!r.nutrition && NUTRITION[r.key]) r.nutrition = NUTRITION[r.key];
  if (!r.nutrition) r.nutrition = { protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

module.exports = RECIPES;
