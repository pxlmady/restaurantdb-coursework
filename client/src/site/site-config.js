// Тексти й налаштування сайту ресторану (етап 10). Назву, адресу й телефон можна змінити тут.
export const SITE = {
  name: 'Калина',
  tagline: 'Ресторан української кухні',
  address: 'м. Київ, вул. Затишна, 10',
  phone: '+380 (44) 000-00-00',
};

// Ілюстрації страв лежать у client/public/site/dishes. Страву з ілюстрацією пов'язує назва
// з таблиці Dish: якщо страву перейменовано або додано нову, допишіть рядок сюди
// (або буде показано заглушку placeholder.svg). Можна класти й фотографії (.jpg, .png).
export const DISH_IMAGES = {
  Борщ: 'borshch.svg',
  'Вареники з вишнею': 'varenyky.svg',
  'Деруни зі сметаною': 'deruny.svg',
  'Котлета по-київськи': 'kotleta.svg',
  Голубці: 'holubtsi.svg',
  "Салат Олів'є": 'olivie.svg',
  'Банош з бринзою': 'banosh.svg',
  Узвар: 'uzvar.svg',
  Компот: 'kompot.svg',
  'Пампушки з часником': 'pampushky.svg',
  'Качка з яблуками': 'kachka.svg',
};

export const PLACEHOLDER_IMAGE = '/site/placeholder.svg';

export const dishImage = (title) =>
  DISH_IMAGES[title] ? `/site/dishes/${DISH_IMAGES[title]}` : PLACEHOLDER_IMAGE;
