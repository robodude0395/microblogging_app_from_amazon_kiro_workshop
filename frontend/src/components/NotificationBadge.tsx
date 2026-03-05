/**
 * Props for the NotificationBadge component
 */
interface NotificationBadgeProps {
  /** The number of notifications to display */
  count: number;
}

/**
 * NotificationBadge displays a small circular badge with a notification count.
 *
 * Features:
 * - Automatically hides when count is 0 or negative
 * - Caps display at "99+" for large numbers to maintain compact size
 * - Uses error color (#e0245e) to draw attention
 * - Fully rounded design consistent with design system
 *
 * Design System Compliance:
 * - Color: Uses --error-color (#e0245e) for high visibility
 * - Typography: 12px font size, 600 weight (semibold)
 * - Border radius: 9999px (fully rounded)
 * - Spacing: 6px horizontal padding for compact display
 *
 * Usage:
 * ```tsx
 * <NotificationBadge count={5} />
 * <NotificationBadge count={150} /> // Displays "99+"
 * ```
 */
export const NotificationBadge = ({ count }: NotificationBadgeProps) => {
  // Don't render anything if there are no notifications
  if (count <= 0) return null;

  // Cap display at 99+ to keep badge compact and readable
  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '20px',
        padding: '0 6px',
        backgroundColor: '#e0245e',
        color: '#ffffff',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: '9999px',
        lineHeight: 1,
      }}
    >
      {displayCount}
    </span>
  );
};
