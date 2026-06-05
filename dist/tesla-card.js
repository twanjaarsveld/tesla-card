import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class TeslaCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _showSettings: { type: Boolean }
    };
  }

  constructor() {
    super();
    this._showSettings = false;
  }

  // Required for UI Editor support
  static getConfigElement() {
    return document.createElement("tesla-card-editor");
  }

  static getStubConfig() {
    return { type: "custom:tesla-card", prefix: "my_tesla" };
  }

  setConfig(config) {
    if (!config.prefix) throw new Error("You must define a prefix");
    this.config = config;
  }

  render() {
    const p = this.config.prefix;
    if (!this.hass || !this.hass.states[`sensor.${p}_battery_level` ]) {
      return html`<ha-card style="padding: 16px;">Connecting...</ha-card>`;
    }

    const state = (entity) => this.hass.states[entity];
    const battery = Math.floor(state(`sensor.${p}_battery_level`)?.state || 0);
    const range = Math.round(state(`sensor.${p}_battery_range`)?.state || 0);
    const inTemp = parseFloat(state(`sensor.${p}_inside_temperature`)?.state || 0);
    const isUnlocked = state(`lock.${p}_lock`)?.state === 'unlocked';
    const hvac = state(`climate.${p}_climate`);
    const isClimateOn = hvac?.state !== 'off' && hvac?.state !== 'unavailable';
    
    const isCharging = state(`sensor.${p}_charging`)?.state === 'charging';
    const chargeLimit = state(`number.${p}_charge_limit`)?.state || 80;
    const chargeAmps = state(`number.${p}_charge_current`)?.state || 16;

    let carImage = `/hacsfiles/tesla-card/images/tesla_off.png`;
    if (isClimateOn) {
      carImage = inTemp < 19 ? `/hacsfiles/tesla-card/images/tesla_preheat.png` : `/hacsfiles/tesla-card/images/tesla_cool.png`;
    } else if (isCharging) {
      carImage = `/hacsfiles/tesla-card/images/tesla_charging.png`;
    }

    return html`
      <ha-card>
        <div class="container">
          <div class="header">
            <div class="battery-main">${battery}%</div>
            <div class="range-sub">${range} km range (Limit: ${chargeLimit}%)</div>
          </div>
          <div class="car-wrapper"><img class="car-img" src="${carImage}" /></div>
          <div class="stats-row">
             <div class="stat-item"><span class="label">ODOMETER</span><span class="value">${Math.round(state(`sensor.${p}_odometer`)?.state || 0)} km</span></div>
             <div class="stat-item"><span class="label">INSIDE</span><span class="value">${inTemp}°C</span></div>
          </div>
          ${this._showSettings ? this.renderSettings(p, chargeLimit, chargeAmps) : this.renderActions(p, isCharging, isUnlocked, isClimateOn, inTemp)}
        </div>
      </ha-card>
    `;
  }

  renderActions(p, isCharging, isUnlocked, isClimateOn, inTemp) {
    return html`
      <div class="actions">
        <button class="btn ${isClimateOn ? (inTemp < 19 ? 'heat-active' : 'cool-active') : ''}" @click="${() => this._toggleClimate(p, isClimateOn)}">
          <ha-icon icon="mdi:fan"></ha-icon> <span>${isClimateOn ? (inTemp < 19 ? 'Heat' : 'Cool') : 'AC'}</span>
        </button>
        <button class="btn ${isCharging ? 'charging-flow' : ''}" @mousedown="${this._handleStart}" @touchstart="${this._handleStart}" @mouseup="${() => this._handleEnd(p, isCharging)}" @touchend="${() => this._handleEnd(p, isCharging)}">
          <ha-icon icon="${isCharging ? 'mdi:battery-charging-60' : 'mdi:ev-station'}"></ha-icon> <span>${isCharging ? 'Stop' : 'Charge'}</span>
        </button>
        <button class="btn ${isUnlocked ? 'unlocked-warn' : ''}" @click="${() => this._toggleLock(p, isUnlocked)}">
          <ha-icon icon="${isUnlocked ? 'mdi:lock-open' : 'mdi:lock'}"></ha-icon> <span>${isUnlocked ? 'Open' : 'Locked'}</span>
        </button>
      </div>
    `;
  }

  renderSettings(p, limit, amps) {
    return html`
      <div class="settings-panel">
        <div class="settings-header"><span>Charging Controls</span><ha-icon icon="mdi:close" @click="${() => this._showSettings = false}" style="cursor:pointer"></ha-icon></div>
        <div class="setting-row"><div class="row-label">Limit: ${limit}%</div><input type="range" min="50" max="100" .value="${limit}" @change="${(e) => this._act('number', 'set_value', {entity_id: `number.${p}_charge_limit`, value: e.target.value})}"></div>
        <div class="setting-row"><div class="row-label">Amps: ${amps}A</div><input type="range" min="0" max="32" .value="${amps}" @change="${(e) => this._act('number', 'set_value', {entity_id: `number.${p}_charge_current`, value: e.target.value})}"></div>
      </div>
    `;
  }

  _handleStart() { this._isLongPress = false; this._pressTimer = window.setTimeout(() => { this._isLongPress = true; this._showSettings = true; }, 600); }
  _handleEnd(p, isCharging) { clearTimeout(this._pressTimer); if (!this._isLongPress) this._act('switch', isCharging ? 'turn_off' : 'turn_on', { entity_id: `switch.${p}_charge` }); }
  _toggleClimate(p, isOn) { this._act('climate', 'set_hvac_mode', { entity_id: `climate.${p}_climate`, hvac_mode: isOn ? 'off' : 'heat_cool' }); }
  _toggleLock(p, isUnl) { this._act('lock', isUnl ? 'lock' : 'unlock', { entity_id: `lock.${p}_lock` }); }
  _act(d, s, data) { this.hass.callService(d, s, data); }

  static get styles() {
    return css`
      .container { padding: 20px; display: flex; flex-direction: column; align-items: center; color: white; background: #1a1a1a; border-radius: 15px; font-family: sans-serif; }
      .battery-main { font-size: 4rem; font-weight: 900; line-height: 1; }
      .range-sub { color: #888; font-size: 0.9rem; margin-top: 5px; }
      .car-wrapper { width: 100%; display: flex; justify-content: center; margin: 15px 0; }
      .car-img { width: 95%; max-width: 450px; }
      .stats-row { width: 100%; display: flex; justify-content: space-around; margin: 15px 0; border-top: 1px solid #333; padding-top: 15px; }
      .label { display: block; font-size: 0.65rem; color: #666; font-weight: bold; text-transform: uppercase; }
      .value { font-size: 1.1rem; font-weight: bold; }
      .actions { width: 100%; display: flex; gap: 8px; }
      .btn { flex: 1; padding: 12px 5px; border-radius: 10px; border: none; background: #333; color: white; font-weight: bold; cursor: pointer; transition: 0.3s; font-size: 0.8rem; }
      .charging-flow { background: #1db954 !important; }
      .heat-active { background: #e67e22 !important; }
      .cool-active { background: #3498db !important; }
      .unlocked-warn { background: #cc0000 !important; }
      .settings-panel { background: #222; padding: 15px; border-radius: 10px; width: 100%; box-sizing: border-box; }
      .settings-header { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; }
      input[type=range] { width: 100%; margin-top: 10px; accent-color: #1db954; cursor: pointer; }
    `;
  }
}
customElements.define("tesla-card", TeslaCard);

class TeslaCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: {} }; }
  setConfig(config) { this._config = config; }
  render() {
    return html`<div class="row"><label>Entity Prefix:</label><input .value="${this._config.prefix || ''}" @input="${(e) => this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: {...this._config, prefix: e.target.value} }, bubbles: true, composed: true }))}"></div>`;
  }
}
customElements.define("tesla-card-editor", TeslaCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tesla-card",
  name: "Tesla Card",
  description: "Tesla control card with range, climate, and charge monitoring.",
  preview: true
});
