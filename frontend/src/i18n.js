/**
 * Light i18n layer - English / Hindi for the main chrome (nav, dashboard,
 * common actions). Page-specific deep copy stays English; the toggle covers
 * the surfaces users touch constantly. Stored in user prefs.
 */
export const LANGS = { en: 'English', hi: 'हिन्दी' };

const DICT = {
  en: {
    dashboard: 'Dashboard', recipes: 'Recipes', planner: 'Meal Planner', nutrition: 'Nutrition', shopping: 'Shopping', priceCompare: 'Price Compare',
    scan: 'Scan & Detect', insights: 'Insights', devices: 'Devices', profile: 'Profile',
    goodMorning: 'Good morning', goodAfternoon: 'Good afternoon', goodEvening: 'Good evening',
    addItems: 'Add item', planWeek: 'Plan week', todaysMeals: "Today's meals",
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', markDone: 'Mark done', undo: 'Undo',
    useSoon: 'Use soon - expiring within 3 days', kitchenInventory: 'Kitchen inventory',
    runningLow: 'Running low', expiring: 'Expiring in 7 days', expiredOut: 'Expired / out',
    itemsInStock: 'Items in stock', kitchenValue: 'Kitchen value (est.)',
    reoptimize: 'Re-optimize week', syncToList: 'Sync shortages to list', orderWeek: 'Order week groceries',
    copyDay: 'Copy day', lock: 'Lock', unlock: 'Unlock', swap: 'Swap',
    comparePrices: 'Compare prices', markBought: 'Mark bought', shareList: 'Share list', copyList: 'Copy list',
    saved: 'Saved', search: 'Search...'
  },
  hi: {
    dashboard: 'डैशबोर्ड', recipes: 'रेसिपी', planner: 'मील प्लानर', nutrition: 'पोषण', shopping: 'खरीदारी', priceCompare: 'कीमत तुलना',
    scan: 'स्कैन', insights: 'विश्लेषण', devices: 'डिवाइस', profile: 'प्रोफ़ाइल',
    goodMorning: 'सुप्रभात', goodAfternoon: 'नमस्कार', goodEvening: 'शुभ संध्या',
    addItems: 'सामान जोड़ें', planWeek: 'सप्ताह बनाएं', todaysMeals: 'आज के भोजन',
    breakfast: 'नाश्ता', lunch: 'दोपहर का खाना', dinner: 'रात का खाना', markDone: 'बन गया', undo: 'वापस',
    useSoon: 'जल्दी इस्तेमाल करें - 3 दिन में खराब', kitchenInventory: 'रसोई का सामान',
    runningLow: 'कम पड़ रहा है', expiring: '7 दिन में खराब', expiredOut: 'खराब / खत्म',
    itemsInStock: 'सामान स्टॉक में', kitchenValue: 'अनुमानित कीमत',
    reoptimize: 'फिर से योजना बनाएं', syncToList: 'लिस्ट में जोड़ें', orderWeek: 'सप्ताह का सामान ऑर्डर करें',
    copyDay: 'दिन कॉपी', lock: 'लॉक', unlock: 'अनलॉक', swap: 'बदलें',
    comparePrices: 'कीमत देखें', markBought: 'खरीद लिया', shareList: 'लिस्ट भेजें', copyList: 'कॉपी',
    saved: 'सेव किया', search: 'खोजें...'
  }
};

export function makeT(lang) {
  const table = DICT[lang] || DICT.en;
  return (key) => table[key] || DICT.en[key] || key;
}
