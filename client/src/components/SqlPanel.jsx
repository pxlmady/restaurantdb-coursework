import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import CodeIcon from '@mui/icons-material/Code';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// Текст SQL-запиту, який виконав сервер, і значення його параметрів (для захисту курсової).
// sql: [{ title, text, params? }] з відповіді /api/queries/...
export default function SqlPanel({ sql }) {
  if (!sql?.length) return null;
  return (
    <Accordion variant="outlined" disableGutters sx={{ mt: 2 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CodeIcon fontSize="small" color="primary" />
          <Typography>SQL-запит</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          {sql.map((item) => (
            <Box key={item.title}>
              <Typography variant="subtitle2" gutterBottom>
                {item.title}
              </Typography>
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 2,
                  overflowX: 'auto',
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  fontFamily: 'ui-monospace, Consolas, monospace',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {item.text}
              </Box>
              {item.params && (
                <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {Object.entries(item.params).map(([name, value]) => (
                    <Chip
                      key={name}
                      size="small"
                      variant="outlined"
                      label={`@${name} = ${value === null ? 'NULL' : value}`}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
