import { type CSSProperties, type HTMLAttributes } from "react";

export type IconStyle = "solid" | "regular" | "light" | "thin" | "duotone" | "brands";

export type IconSize = "2xs" | "xs" | "sm" | "lg" | "xl" | "2xl" | "1x" | "2x" | "3x" | "4x" | "5x" | "6x" | "7x" | "8x" | "9x" | "10x";

export interface IconProps extends Omit<HTMLAttributes<HTMLElement>, "style"> {
  name: string;
  variant?: IconStyle;
  size?: IconSize;
  fixedWidth?: boolean;
  spin?: boolean;
  pulse?: boolean;
  beat?: boolean;
  bounce?: boolean;
  shake?: boolean;
  flip?: boolean;
  color?: string;
  secondaryColor?: string;
  secondaryOpacity?: number;
  style?: CSSProperties;
}

const VARIANT_PREFIX: Record<IconStyle, string> = {
  solid: "fa-solid",
  regular: "fa-regular",
  light: "fa-light",
  thin: "fa-thin",
  duotone: "fa-duotone",
  brands: "fa-brands",
};

export function Icon({
  name,
  variant = "solid",
  size,
  fixedWidth,
  spin,
  pulse,
  beat,
  bounce,
  shake,
  flip,
  color,
  secondaryColor,
  secondaryOpacity,
  className,
  style,
  ...rest
}: IconProps) {
  const iconName = name.startsWith("fa-") ? name : `fa-${name}`;
  const classes = [
    VARIANT_PREFIX[variant],
    iconName,
    size ? `fa-${size}` : null,
    fixedWidth ? "fa-fw" : null,
    spin ? "fa-spin" : null,
    pulse ? "fa-pulse" : null,
    beat ? "fa-beat" : null,
    bounce ? "fa-bounce" : null,
    shake ? "fa-shake" : null,
    flip ? "fa-flip" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const composedStyle: CSSProperties & Record<string, string | number | undefined> = {
    ...(color ? { color } : {}),
    ...(variant === "duotone" && secondaryColor ? { "--fa-secondary-color": secondaryColor } : {}),
    ...(variant === "duotone" && secondaryOpacity !== undefined
      ? { "--fa-secondary-opacity": secondaryOpacity }
      : {}),
    ...style,
  };

  return <i aria-hidden="true" className={classes} style={composedStyle} {...rest} />;
}
