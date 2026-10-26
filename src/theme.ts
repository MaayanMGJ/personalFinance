// Warm, soft palette. Partner colors tell the two people apart everywhere.
export const colors = {
  bg: '#FBF6F1',
  surface: '#FFFFFF',
  text: '#2B2320',
  muted: '#7A6A62',
  border: '#EDE3DA',
  primary: '#E07A5F',
  primarySoft: '#F8E1D8',
  onPrimary: '#FFFFFF',
  sage: '#81B29A',
  sageSoft: '#E3F0E8',
  danger: '#B4483A',
  partners: ['#E07A5F', '#3D7EA6'],
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  small: { fontSize: 14, color: colors.muted },
  big: { fontSize: 40, fontWeight: '700' as const, color: colors.text },
};

export function partnerColor(sortOrder: number): string {
  return colors.partners[sortOrder % colors.partners.length];
}
