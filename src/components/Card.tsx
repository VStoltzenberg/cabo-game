import { motion } from 'framer-motion';
import type { Card } from '../types/game';
import { getCardTheme, actionName } from '../game/engine';

interface CardProps {
  card: Card;
  faceDown?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function CardComponent({
  card,
  faceDown = false,
  selected = false,
  highlighted = false,
  onClick,
  size = 'md',
  className = '',
}: CardProps) {
  const theme = getCardTheme(card.value);

  const sizeClasses = {
    sm:  'w-14 h-20 text-lg',
    md:  'w-20 h-28 text-2xl',
    lg:  'w-24 h-36 text-3xl',
  };

  const baseClass = `
    relative rounded-xl cursor-pointer select-none
    ${sizeClasses[size]}
    ${selected ? 'ring-4 ring-yellow-400 scale-110' : ''}
    ${highlighted ? 'ring-4 ring-blue-400 scale-105' : ''}
    ${onClick ? 'hover:scale-105 active:scale-95' : ''}
    transition-all duration-200
    ${className}
  `;

  if (faceDown) {
    return (
      <motion.div
        className={baseClass}
        onClick={onClick}
        whileTap={{ scale: 0.95 }}
        style={{
          background: 'linear-gradient(135deg, #2d1b69 0%, #1a0a2e 50%, #4a2080 100%)',
          boxShadow: selected
            ? '0 0 20px rgba(250,204,21,0.8)'
            : '0 4px 12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Card back pattern */}
        <div className="absolute inset-1 rounded-lg overflow-hidden opacity-30"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              #7c3aed 0px, #7c3aed 2px,
              transparent 2px, transparent 10px
            )`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          ✦
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={baseClass}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      style={{
        background: `linear-gradient(135deg, ${theme.bg.replace('from-', '').replace(' to-', ', ')})`,
        boxShadow: selected
          ? `0 0 20px rgba(250,204,21,0.8), 0 4px 12px rgba(0,0,0,0.5)`
          : highlighted
          ? `0 0 16px rgba(96,165,250,0.8), 0 4px 12px rgba(0,0,0,0.5)`
          : '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      {/* Value top-left */}
      <div
        className="absolute top-1 left-1.5 font-bold leading-none"
        style={{ color: theme.accent, fontSize: size === 'sm' ? '0.7rem' : '0.9rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {card.value}
      </div>

      {/* Emoji center */}
      <div className={`absolute inset-0 flex items-center justify-center ${sizeClasses[size].split(' ')[2]}`}>
        {theme.emoji}
      </div>

      {/* Action label */}
      {card.action && (
        <div
          className="absolute bottom-0.5 left-0 right-0 text-center font-bold"
          style={{
            color: theme.accent,
            fontSize: '0.55rem',
            textShadow: '0 1px 3px rgba(0,0,0,0.9)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {actionName(card.action)}
        </div>
      )}

      {/* Value bottom-right (rotated) */}
      <div
        className="absolute bottom-1 right-1.5 font-bold leading-none rotate-180"
        style={{ color: theme.accent, fontSize: size === 'sm' ? '0.7rem' : '0.9rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
      >
        {card.value}
      </div>
    </motion.div>
  );
}

// Face-down placeholder
export function CardBack({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <CardComponent
      card={{ id: -1, value: 0, action: null }}
      faceDown
      size={size}
      className={className}
    />
  );
}
