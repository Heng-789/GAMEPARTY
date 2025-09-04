// hooks/useCodes.ts
import React from 'react';
export function useCodes(initialCount = 1) {
  const [count, setCount] = React.useState(initialCount);
  const [codes, setCodes] = React.useState<string[]>(Array(initialCount).fill(''));
  React.useEffect(() => {
    setCodes((prev) => {
      const next = [...prev];
      if (count > next.length) while (next.length < count) next.push('');
      else next.length = count;
      return next;
    });
  }, [count]);
  return { count, setCount, codes, setCodes };
}
