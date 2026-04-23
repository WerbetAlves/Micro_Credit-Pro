export const isDateOnlyString = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export const parseAppDate = (value: string) => {
  if (!isDateOnlyString(value)) {
    return new Date(value);
  }

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
