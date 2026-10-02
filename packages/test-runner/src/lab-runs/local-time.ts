/** A moment as the person reading the folder sees it: the machine's local date (`YYYY-MM-DD`) and time (`HH:MM:SS`). */
export function localDateTime(moment: Date): { date: string; time: string } {
  const two = (value: number) => String(value).padStart(2, "0");
  return {
    date: `${moment.getFullYear()}-${two(moment.getMonth() + 1)}-${two(moment.getDate())}`,
    time: `${two(moment.getHours())}:${two(moment.getMinutes())}:${two(moment.getSeconds())}`,
  };
}
