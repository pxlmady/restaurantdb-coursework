import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { NAVIGATION } from '../navigation.jsx';
import ColorModeMenu from './ColorModeMenu.jsx';

const DRAWER_WIDTH = 240;

// Каркас застосунку: верхня панель і бічне меню з розділами.
// На вузькому екрані меню відкривається кнопкою, на широкому видно завжди.
export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menu = (
    <Box>
      <Toolbar />
      {NAVIGATION.map((group, index) => (
        <Box key={group.title ?? index}>
          {index > 0 && <Divider />}
          <List
            dense
            subheader={group.title && <ListSubheader disableSticky>{group.title}</ListSubheader>}
          >
            {group.items.map((item) => (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setMobileOpen(false)}
                sx={{ '&.active': { bgcolor: 'action.selected', fontWeight: 600 } }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Меню"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" noWrap>
            RestaurantDB
          </Typography>
          <Typography
            variant="body2"
            sx={{ ml: 2, opacity: 0.8, display: { xs: 'none', sm: 'block' } }}
          >
            база даних ресторану
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <ColorModeMenu />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {menu}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {menu}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
