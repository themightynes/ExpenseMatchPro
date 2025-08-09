# User Interface Design Guide

## Overview
The Receipt Manager application features a modern, financial app-inspired interface designed for comprehensive expense management workflows. The UI prioritizes data visibility, user efficiency, and intuitive navigation.

## Design Philosophy

### Visual Hierarchy
- **Primary Actions**: Prominently displayed with clear visual emphasis
- **Secondary Information**: Organized in digestible chunks with appropriate spacing
- **Status Indicators**: Color-coded system for instant recognition
- **Data Density**: Balanced approach showing maximum relevant information without overwhelming users

### Color System
- **Success/Matched**: Green (#10B981) - For matched receipts and completed actions
- **Warning/Pending**: Orange (#F59E0B) - For items requiring attention
- **Error/Unmatched**: Red (#EF4444) - For missing receipts or errors
- **Info/Personal**: Purple (#8B5CF6) - For personal expenses and notes
- **Neutral**: Gray (#6B7280) - For secondary information and borders

## Component Design Standards

### Statement Detail Pages
**Layout**: Full-width container with responsive vertical card system
- Header section with navigation and export actions
- Statistics cards with color-coded metrics
- Filter and search controls
- Vertical expense cards with structured information display
- Expandable sections for detailed information

**Vertical Card Design**:
- Three-row information structure for optimal readability
- Row 1: Date and description with extended details
- Row 2: Amount, category, and card member information
- Row 3: Match status, personal/business toggle, and notes functionality
- Hover effects for enhanced interactivity
- Expandable notes sections with smooth transitions
- Direct receipt links for matched expenses
- Mobile-optimized layout without horizontal scrolling

**Legacy Table Design** (replaced with cards):
- Sticky header for long lists
- Alternating row colors for readability
- Hover states for interactive elements
- Responsive horizontal scrolling on mobile
- Sort indicators on column headers
- Action buttons appropriately sized for touch

### Cards and Containers
**Visual Elements**:
- Subtle shadows for depth without distraction
- Rounded corners (8px) for modern appearance
- Consistent padding (16px standard, 12px compact)
- Border accents for categorization (left border color coding)

**Expense Cards**:
- Structured 3-row layout for expense information
- Hover effects with subtle shadow transitions
- Border-based visual hierarchy (gray border with hover enhancement)
- Expandable sections with smooth animations
- Integrated action buttons with consistent spacing
- Visual status indicators through badges and color coding

### Interactive Elements
**Buttons**:
- Primary: Solid background with brand colors
- Secondary: Outline style with hover states
- Destructive: Red accent for delete actions
- Icon buttons: Consistent sizing (32px standard, 24px compact)

**Form Controls**:
- Clear focus states with accessibility considerations
- Consistent height (40px) and padding
- Error states with appropriate color coding
- Helper text positioned below inputs

## Data Visualization

### Financial Metrics
**Display Format**:
- Currency values: USD format with appropriate decimal precision
- Large numbers: Comma separation for readability
- Percentages: Single decimal precision when relevant
- Status badges: Consistent sizing and color coding

### Tables and Lists
**Information Architecture**:
- Most important data in leftmost columns
- Progressive disclosure for detailed information
- Consistent column widths for scanning
- Action columns right-aligned

## Mobile Responsiveness

### Breakpoint Strategy
- **Desktop**: 1024px+ - Full table layout with all columns
- **Tablet**: 768px-1023px - Condensed columns with horizontal scroll
- **Mobile**: <768px - Stacked card layout for complex data

### Touch Interactions
- Minimum 44px touch targets
- Appropriate spacing between interactive elements
- Swipe gestures for secondary actions where appropriate
- Long-press for contextual menus

## Accessibility Standards

### Visual Accessibility
- High contrast ratios (4.5:1 minimum)
- Color is not the only means of conveying information
- Focus indicators clearly visible
- Text sizing respects user preferences

### Keyboard Navigation
- Logical tab order throughout interfaces
- Keyboard shortcuts for common actions
- Skip links for complex layouts
- Escape key closes modals and dropdowns

## Performance Considerations

### Loading States
- Skeleton screens for data-heavy components
- Progressive loading for large tables
- Immediate feedback for user actions
- Optimistic updates where appropriate

### Data Display
- Virtualization for large datasets
- Debounced search to reduce API calls
- Pagination or infinite scroll for long lists
- Cached data where appropriate

## Content Guidelines

### Microcopy
- Clear, action-oriented button text
- Helpful error messages with suggested actions
- Consistent terminology throughout application
- Progressive disclosure of complex information

### Status Messages
- Success messages: Brief and confirmatory
- Error messages: Specific with resolution steps
- Warning messages: Clear about required actions
- Info messages: Contextual and helpful

## Future Considerations

### Scalability
- Component library approach for consistency
- Design token system for easy theming
- Modular layout system for new features
- Responsive image handling for receipts

### User Experience Enhancements
- Dark mode support preparation
- Advanced filtering and search capabilities
- Bulk operations for efficiency
- Customizable dashboard layouts