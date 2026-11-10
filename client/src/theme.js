import { createTheme } from '@mui/material/styles';
import { ukUA } from '@mui/material/locale';

// Тема адмін-панелі (етап 7a): світла й темна схеми MUI.
// Схема за замовчуванням — як у системі; вибір користувача MUI зберігає в localStorage.
// CSS-змінні (cssVariables) дають змогу перемикати схему без перемальовування компонентів.
export const theme = createTheme(
  {
    cssVariables: { colorSchemeSelector: 'class' },
    colorSchemes: {
      light: {
        palette: {
          primary: { main: '#1e5b8f' },
          background: { default: '#f6f7f9', paper: '#ffffff' },
        },
      },
      dark: {
        palette: {
          primary: { main: '#8ab8e6' },
          background: { default: '#121417', paper: '#1b1e23' },
        },
      },
    },
    shape: { borderRadius: 8 },
    components: {
      // Українські написи капсом читаються гірше, тому кнопки без ВЕЛИКИХ ЛІТЕР
      MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
      // Картки й таблиці з рамкою замість тіні: однаково виглядають в обох схемах
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiAppBar: { defaultProps: { elevation: 0 } },
      MuiChip: { styleOverrides: { root: { fontWeight: 500 } } },
    },
  },
  ukUA,
);
