import chalk from 'chalk';

export interface Theme {
  readonly accent: (text: string) => string;
  readonly accentBold: (text: string) => string;
  readonly tag: (text: string) => string;
  readonly link: (text: string) => string;
  readonly dim: (text: string) => string;
  readonly error: (text: string) => string;
  readonly warning: (text: string) => string;
  readonly selected: (text: string) => string;
  readonly bold: (text: string) => string;
  readonly heading: (text: string) => string;
  readonly keyBadge: (text: string) => string;
  readonly tabActive: (text: string) => string;
  readonly tabInactive: (text: string) => string;
}

const supportsColor = chalk.level >= 3; // True Color (level 3 = 16M colors)

export const theme: Theme = {
  accent: supportsColor ? chalk.hex('#56b6c2') : chalk.cyan,
  accentBold: supportsColor ? chalk.hex('#56b6c2').bold : chalk.cyan.bold,
  tag: supportsColor ? chalk.hex('#c678dd') : chalk.magenta,
  link: supportsColor ? chalk.hex('#61afef').underline : chalk.blue.underline,
  dim: chalk.dim,
  error: supportsColor ? chalk.hex('#e06c75') : chalk.red,
  warning: supportsColor ? chalk.hex('#e5c07b') : chalk.yellow,
  selected: supportsColor ? chalk.hex('#98c379').bold : chalk.green.bold,
  bold: chalk.bold,
  heading: supportsColor ? chalk.hex('#56b6c2').bold : chalk.cyan.bold,
  keyBadge: supportsColor
    ? chalk.bgHex('#56b6c2').hex('#1e1e2e')
    : chalk.bgCyan.black,
  tabActive: supportsColor
    ? chalk.bgHex('#98c379').hex('#1e1e2e')
    : chalk.bgGreen.black,
  tabInactive: supportsColor
    ? chalk.bgHex('#3e4452').hex('#abb2bf')
    : chalk.bgGray.white,
};
