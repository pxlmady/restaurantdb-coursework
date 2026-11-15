import { createTheme } from '@mui/material/styles';
import { ukUA } from '@mui/material/locale';

// Оформлення сайту ресторану (етап 10): окрема тема MUI, не пов'язана з темою адмін-панелі.
// Теплі кольори, заголовки шрифтом із зарубками; завжди світла, незалежно від теми адмінки.
const serif = 'Georgia, "Times New Roman", serif';

export const siteTheme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: '#8f2a20', contrastText: '#fffaf2' },
      secondary: { main: '#35543c', contrastText: '#fffaf2' },
      background: { default: '#fbf6ec', paper: '#fffdf8' },
      text: { primary: '#2a211b', secondary: '#6b5d52' },
      divider: '#e6dac6',
    },
    shape: { borderRadius: 12 },
    typography: {
      h1: { fontFamily: serif, fontWeight: 700 },
      h2: { fontFamily: serif, fontWeight: 700 },
      h3: { fontFamily: serif, fontWeight: 700 },
      h4: { fontFamily: serif, fontWeight: 700 },
      h5: { fontFamily: serif, fontWeight: 700 },
      h6: { fontFamily: serif, fontWeight: 700 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, borderRadius: 999, paddingInline: 20 },
        },
      },
      MuiPaper: { defaultProps: { elevation: 0 } },
      MuiCard: {
        styleOverrides: { root: { border: '1px solid #e6dac6', overflow: 'hidden' } },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
    },
  },
  ukUA,
);
