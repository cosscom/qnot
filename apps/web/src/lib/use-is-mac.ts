'use client';
import { useEffect, useState } from 'react';

export function useIsMac() {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => setIsMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)), []);
  return isMac;
}
