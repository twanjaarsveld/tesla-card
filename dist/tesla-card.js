import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

console.info(
  `%c TESLA-CARD `,
  'color: white; font-weight: bold; background: #E81E24'
);

// ====================================================================
// MAIN CARD CLASS
// ====================================================================
class TeslaCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
      _activeMode: { type: String }, 
      _tempLimit: { type: Number },
      _tempAmps: { type: Number }
    };
  }

  static getConfigElement() {
    return document.createElement("tesla-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:tesla-card",
      device_id: "",
      prefix: ""
    };
  }

  constructor() {
    super();
    this._activeMode = 'stats';
  }

  render() {
    const basePath = "/local/community/tesla-card/";
    const p = this.config.prefix;
    
    if (!this.hass || !p || !this.hass.states[`sensor.${p}_battery_level`]) {
      return html`<ha-card style="padding: 16px;">Connecting... (Please click edit and select your Tesla Device)</ha-card>`;
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
    
    const batteryRound = Math.round(battery / 10) * 10;
    const chargeIcon = isCharging ? `mdi:battery-charging-${batteryRound === 0 ? 'outline' : batteryRound}` : 'mdi:ev-station';

    let carImage = `${basePath}images/tesla_off.png`;
    if (isClimateOn) {
      carImage = inTemp < 19 ? `${basePath}images/tesla_preheat.png` : `${basePath}images/tesla_cool.png`;
    } else if (isCharging) {
      carImage = `${basePath}images/tesla_charging.png`;
    }

    return html`
      <ha-card>
        <div class="container">
          <div class="header">
            <div class="battery-main">${battery}%</div>
            <div class="range-sub">${range} km range (Limit: ${chargeLimit}%)</div>
          </div>

          <div class="car-wrapper">
             <img class="car-img" src="${carImage}" />
          </div>

          <div class="dynamic-area">
            ${this._renderDynamicContent(p, state, inTemp, chargeLimit, basePath)}
          </div>

          <div class="actions">
            <button class="btn ${isClimateOn ? (inTemp < 19 ? 'heat-active' : 'cool-active') : ''}" 
                    @click="${() => this._act('climate', 'set_hvac_mode', { entity_id: `climate.${p}_climate`, hvac_mode: isClimateOn ? 'off' : 'heat_cool' })}">
              <ha-icon icon="mdi:fan"></ha-icon> <span>${isClimateOn ? (inTemp < 19 ? 'Heat' : 'Cool') : 'AC'}</span>
            </button>

            <button class="btn ${isCharging ? 'charging-flow' : ''}" 
                    @mousedown="${() => this._handleStart('charge')}" 
                    @touchstart="${() => this._handleStart('charge')}"
                    @mouseup="${() => this._handleEnd(p, 'charge', isCharging)}"
                    @touchend="${() => this._handleEnd(p, 'charge', isCharging)}">
              <ha-icon icon="${chargeIcon}"></ha-icon> <span>${isCharging ? 'Stop' : 'Charge'}</span>
            </button>
            
            <button class="btn ${isUnlocked ? 'unlocked-warn' : ''}" 
                    @mousedown="${() => this._handleStart('locks')}" 
                    @touchstart="${() => this._handleStart('locks')}"
                    @mouseup="${() => this._handleEnd(p, 'locks', isUnlocked)}"
                    @touchend="${() => this._handleEnd(p, 'locks', isUnlocked)}">
              <ha-icon icon="${isUnlocked ? 'mdi:lock-open' : 'mdi:lock'}"></ha-icon> <span>${isUnlocked ? 'Open' : 'Locked'}</span>
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }

  _renderDynamicContent(p, state, inTemp, chargeLimit, basePath) {
    if (this._activeMode === 'charge') {
        const currentAmps = state(`number.${p}_charge_current`)?.state || 16;
        const limitDisplay = this._tempLimit !== undefined ? this._tempLimit : chargeLimit;
        const ampsDisplay = this._tempAmps !== undefined ? this._tempAmps : currentAmps;
        return html`
          <div class="settings-grid">
            <div class="setting-col">
              <div class="row-label">Limit: <strong>${limitDisplay}%</strong></div>
              <input type="range" min="50" max="100" .value="${limitDisplay}" 
                @input="${(e) => this._tempLimit = e.target.value}"
                @change="${(e) => this._act('number', 'set_value', {entity_id: `number.${p}_charge_limit`, value: e.target.value})}">
            </div>
            <div class="setting-col">
              <div class="row-label">Amps: <strong>${ampsDisplay}A</strong></div>
              <input type="range" min="5" max="16" .value="${ampsDisplay}" 
                @input="${(e) => this._tempAmps = e.target.value}"
                @change="${(e) => this._act('number', 'set_value', {entity_id: `number.${p}_charge_current`, value: e.target.value})}">
            </div>
            <ha-icon class="close-btn" icon="mdi:close-circle" @click="${() => this._resetMode()}"></ha-icon>
          </div>`;
    }

    if (this._activeMode === 'locks') {
        const winState = state(`cover.${p}_windows`)?.state;
        const isWinClosed = winState === 'closed';
        return html`
          <div class="settings-grid">
            <button class="mini-btn" @click="${() => this._act('button', 'press', {entity_id: `button.${p}_front_trunk`})}"><img src="${basePath}images/icons/frunk.png" style="width:24px;height:24px;">Frunk</button>
            <button class="mini-btn" @click="${() => this._act('button', 'press', {entity_id: `button.${p}_rear_trunk`})}"><img src="${basePath}images/icons/trunk.png" style="width:24px;height:24px;">Trunk</button>
            <button class="mini-btn" @click="${() => this._act('cover', isWinClosed ? 'open_cover' : 'close_cover', {entity_id: `cover.${p}_windows`})}">
                <img src="${basePath}images/icons/vent.png" style="width:24px;height:24px;">${isWinClosed ? 'Vent' : 'Close'}
            </button>
            <ha-icon class="close-btn" icon="mdi:close-circle" @click="${() => this._resetMode()}"></ha-icon>
          </div>`;
    }

    return html`
      <div class="stats-row">
         <div class="stat-item"><span class="label">ODOMETER</span><span class="value">${Math.round(state(`sensor.${p}_odometer`)?.state || 0)} km</span></div>
         <div class="stat-item"><span class="label">INSIDE</span><span class="value">${inTemp}°C</span></div>
      </div>`;
  }

  _handleStart(mode) {
    this._isLongPress = false;
    this._pressTimer = window.setTimeout(() => {
      this._isLongPress = true;
      this._activeMode = mode;
    }, 600);
  }

  _handleEnd(prefix, mode, currentState) {
    clearTimeout(this._pressTimer);
    if (!this._isLongPress) {
      if (this._activeMode !== 'stats') {
        this._resetMode();
      } else if (mode === 'charge') {
        this._act('switch', currentState ? 'turn_off' : 'turn_on', { entity_id: `switch.${prefix}_charge` });
      } else if (mode === 'locks') {
        this._act('lock', currentState ? 'lock' : 'unlock', { entity_id: `lock.${prefix}_lock` });
      }
    }
  }

  _resetMode() { this._activeMode = 'stats'; this._tempLimit = undefined; this._tempAmps = undefined; }
  _act(domain, service, data) { this.hass.callService(domain, service, data); }
  setConfig(config) { this.config = config; }

  static get styles() {
    return css`
      :host { --tesla-text: var(--primary-text-color, white); --tesla-accent: var(--secondary-text-color, #888); }
      .container { padding: 20px; display: flex; flex-direction: column; align-items: center; color: var(--tesla-text); 
        background: var(--ha-card-background, rgba(255, 255, 255, 0.05)); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); 
        border-radius: var(--ha-card-border-radius, 15px); border: 1px solid rgba(255,255,255,0.1); font-family: sans-serif; }
      .battery-main { font-size: 4rem; font-weight: 900; line-height: 1; }
      .range-sub { color: var(--tesla-accent); font-size: 0.9rem; margin-top: 5px;}
      .car-wrapper { width: 100%; display: flex; justify-content: center; margin: 10px 0; }
      .car-img { width: 90%; max-width: 400px; filter: drop-shadow(0 10px 15px rgba(0,0,0,0.5)); }
      .dynamic-area { width: 100%; height: 80px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; }
      .stats-row { width: 100%; display: flex; justify-content: space-around; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; }
      .label { display: block; font-size: 0.65rem; color: var(--tesla-accent); font-weight: bold; text-transform: uppercase; }
      .value { font-size: 1.1rem; font-weight: bold; }
      .settings-grid { position: relative; width: 100%; display: flex; gap: 10px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; align-items: center; }
      .setting-col { flex: 1; }
      .row-label { font-size: 0.75rem; color: var(--tesla-accent); }
      .mini-btn { flex: 1; background: rgba(255,255,255,0.1); border: none; color: white; padding: 8px; border-radius: 8px; cursor: pointer; display: flex; flex-direction: column; align-items: center; font-size: 0.7rem; gap: 4px; }
      .close-btn { position: absolute; top: -12px; right: -5px; cursor: pointer; color: #ff5252; --mdc-icon-size: 20px; z-index: 5; }
      input[type=range] { width: 100%; margin-top: 5px; accent-color: #1db954; cursor: pointer; }
      .actions { width: 100%; display: flex; gap: 8px; }
      .btn { flex: 1; padding: 12px 5px; border-radius: 12px; border: none; background: rgba(255,255,255,0.1); color: var(--tesla-text); font-weight: bold; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: 0.2s; font-size: 0.8rem; overflow: hidden; position: relative; }
      .charging-flow { background: #1db954 !important; color: white !important; }
      .charging-flow::after { content: ""; position: absolute; top: 0; left: -100%; width: 200%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: flow 1.5s infinite linear; }
      @keyframes flow { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      .heat-active { background: #e67e22 !important; color: white !important; }
      .cool-active { background: #3498db !important; color: white !important; }
      .unlocked-warn { background: #cc0000 !important; color: white !important; }
    `;
  }
}
customElements.define("tesla-card", TeslaCard);

class TeslaCardEditor extends LitElement {
  static get properties() { return { hass: {}, _config: {} }; }
  setConfig(config) { this._config = config; }
  render() {
    if (!this.hass || !this._config) return html``;
    const deviceSelector = { device: {} };
    return html`
      <div class="card-config">
        <p class="intro-text">Select your Tesla vehicle device from the dropdown below to automatically detect the matching entity prefixes.</p>
        <ha-selector .hass=${this.hass} .selector=${deviceSelector} .value=${this._config.device_id || ""} label="Select Tesla Car" @value-changed=${this._deviceChanged}></ha-selector>
        ${this._config.prefix ? html`
          <div class="prefix-display">
            <span>Linked Device Prefix:</span>
            <strong>${this._config.prefix}</strong>
          </div>
        ` : html``}
      </div>
    `;
  }
  _deviceChanged(ev) {
    if (!this._config) return;
    const selectedDeviceId = ev.detail.value;
    let computedPrefix = "";
    if (selectedDeviceId && this.hass.entities) {
      const matchingEntityId = Object.keys(this.hass.entities).find(
        (id) => this.hass.entities[id].device_id === selectedDeviceId
      );
      if (matchingEntityId) {
        const entityIdWithoutDomain = matchingEntityId.split(".")[1];
        const suffixes = /(?:_battery_level|_battery_range|_inside_temperature|_outside_temperature|_lock|_climate|_charging|_charge_limit|_charge_current|_odometer|_windows|_front_trunk|_rear_trunk|_status)$/;
        computedPrefix = entityIdWithoutDomain.replace(suffixes, "");
      }
    }
    const newConfig = { ...this._config, device_id: selectedDeviceId, prefix: computedPrefix };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true }));
  }
  static get styles() {
    return css`
      .card-config { display: flex; flex-direction: column; gap: 14px; padding: 8px 0; font-family: sans-serif; }
      .intro-text { font-size: 0.95rem; color: var(--secondary-text-color); margin: 0 0 4px 0; line-height: 1.4; }
      .prefix-display { display: flex; justify-content: space-between; align-items: center; background: var(--secondary-background-color, rgba(0,0,0,0.05)); padding: 12px; border-radius: 8px; border: 1px dashed var(--divider-color, rgba(255,255,255,0.1)); font-size: 0.9rem; }
      .prefix-display strong { color: #1db954; font-family: monospace; font-size: 1rem; }
    `;
  }
}
customElements.define("tesla-card-editor", TeslaCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tesla-card",
  name: "Tesla Card",
  description: "A clean card to control and view status of your Tesla",
});
