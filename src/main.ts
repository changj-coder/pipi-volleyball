import { VolleyballGame } from './game/VolleyballGame';
import './styles.css';

const appRoot = document.querySelector<HTMLDivElement>('#app');

if (!appRoot) {
  throw new Error('Missing #app root element.');
}

const game = new VolleyballGame(appRoot);
void game.start();
