import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SystemModeIcon from '@mui/icons-material/SettingsBrightnessOutlined';

const MODES = [
  { value: 'light', label: 'Світла', icon: <LightModeIcon fontSize="small" /> },
  { value: 'dark', label: 'Темна', icon: <DarkModeIcon fontSize="small" /> },
  { value: 'system', label: 'Як у системі', icon: <SystemModeIcon fontSize="small" /> },
];

// Перемикач теми у верхній панелі: світла, темна або як у налаштуваннях ОС
export default function ColorModeMenu() {
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState(null);

  // До першого рендеру на клієнті mode ще невідомий
  if (!mode) return null;
  const current = MODES.find((m) => m.value === mode) ?? MODES[2];

  return (
    <>
      <Tooltip title={`Тема: ${current.label.toLowerCase()}`}>
        <IconButton color="inherit" aria-label="Тема" onClick={(e) => setAnchor(e.currentTarget)}>
          {current.icon}
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {MODES.map((item) => (
          <MenuItem
            key={item.value}
            selected={item.value === mode}
            onClick={() => {
              setMode(item.value);
              setAnchor(null);
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
