import { BaseScene } from '/assets/js/core/SceneManager.js';

/**
 * Un solo filtro: ¿vendes rifas? → entra a la experiencia.
 */
export class FilterScene extends BaseScene {
  async enter() {
    this.root.classList.add('scene-filter', 'scene--centered');
    this._ask();
  }

  _ask() {
    this.root.innerHTML = `
      <div class="scene-copy filter-copy">
        <p class="scene-kicker is-intense fade-up">
          ¿Vendes rifas o sorteos?
        </p>
        <div class="decision-grid fade-up" style="animation-delay:.2s">
          <button type="button" class="btn-choice btn-choice--auto" id="filter-yes">
            Sí, vendo rifas
          </button>
          <button type="button" class="btn-choice" id="filter-no">
            No
          </button>
        </div>
      </div>
    `;

    this.root.querySelector('#filter-yes')?.addEventListener(
      'click',
      async () => {
        await this.ctx.audio.unlock();
        this._pass();
      },
      { signal: this.ac.signal }
    );

    this.root.querySelector('#filter-no')?.addEventListener(
      'click',
      async () => {
        await this.ctx.audio.unlock();
        this._reject();
      },
      { signal: this.ac.signal }
    );
  }

  async _pass() {
    this.ctx.tracking.track('ViewContent', {
      scene: 'FILTER',
      interaction: 'sells_raffles_yes',
      content_name: 'filter_yes',
    });
    this.ctx.qualified = true;

    this.root.innerHTML = `
      <div class="scene-copy filter-copy">
        <p class="scene-kicker is-intense fade-up">Sube el volumen.</p>
      </div>
    `;

    await this.wait(1200);
    if (this.aborted) return;
    this.next('INTRO');
  }

  _reject() {
    this.ctx.tracking.track('ExperienceSkipped', {
      scene: 'FILTER',
      interaction: 'not_seller',
    });
    this.ctx.qualified = false;

    this.root.innerHTML = `
      <div class="scene-copy filter-copy">
        <p class="scene-kicker is-intense fade-up">Esta experiencia es para quien vende rifas.</p>
        <p class="scene-sub fade-up" style="margin-top:1rem;animation-delay:.2s">
          Si más adelante administras rifas, vuelve. CCM SOFTWARE está hecho para eso.
        </p>
        <div class="actions fade-up" style="animation-delay:.35s">
          <button type="button" class="btn-secondary" id="filter-back">Volver</button>
          <a class="btn-secondary" href="https://ccmsoftware.com.co/" rel="noopener noreferrer" target="_blank">
            Ir a CCM SOFTWARE
          </a>
        </div>
      </div>
    `;

    this.root.querySelector('#filter-back')?.addEventListener(
      'click',
      () => this._ask(),
      { signal: this.ac.signal }
    );
  }
}
