// Shared collision rules for manual walking; bridge decks must join both plazas.
export function createWalkSurface(hexes, bridges, radius) {
  const inner = radius * Math.sqrt(3) / 2;
  function hexAt(x, z) {
    return hexes.find(h => {
      const dx = Math.abs(x - h.x), dz = Math.abs(z - h.z);
      return dx <= inner && dz <= radius && dx + Math.sqrt(3) * dz <= Math.sqrt(3) * radius;
    }) || null;
  }
  function onBridge(x, z) {
    return bridges.some(({pa, pb}) => {
      const dx = pb.x - pa.x, dz = pb.z - pa.z;
      const t = Math.max(0, Math.min(1, ((x-pa.x)*dx+(z-pa.z)*dz)/(dx*dx+dz*dz || 1)));
      return Math.hypot(x-pa.x-t*dx, z-pa.z-t*dz) <= .41;
    });
  }
  function walkable(x, z) {
    if (onBridge(x, z)) return true;
    const h = hexAt(x, z);
    return !!h && !(h.land && h.kind !== 'plain' && Math.hypot(x-h.x,z-h.z) < 1.25);
  }
  return {hexAt, onBridge, walkable};
}

export function acceptsMovementKey(target) {
  if (!target?.closest) return true;
  return !target.closest('input, select, textarea, [contenteditable="true"], [role="textbox"]');
}
