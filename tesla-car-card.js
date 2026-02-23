import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class TeslaCarCard extends LitElement {
  static get properties() {
    return {
      hass: {},
      config: {},
    };
  }

  render() {
    const p = this.config.prefix;
    if (!this.hass || !this.hass.states[`sensor.${p}_battery_level`]) {
      return html`<ha-card style="padding:16px;">Connecting...</ha-card>`;
    }

    const state = (e) => this.hass.states[e];

    const battery = Math.floor(state(`sensor.${p}_battery_level`)?.state || 0);
    const range = Math.round(state(`sensor.${p}_battery_range`)?.state || 0);
    const inTemp = parseFloat(state(`sensor.${p}_inside_temperature`)?.state || 0);
    const isUnlocked = state(`lock.${p}_lock`)?.state === "unlocked";
    const hvac = state(`climate.${p}_climate`);
    const isClimateOn = hvac?.state !== "off" && hvac?.state !== "unavailable";

    const isCharging = state(`sensor.${p}_charging`)?.state === "charging";
    const chargeLimit = state(`number.${p}_charge_limit`)?.state || "--";

    let carImage = `/local/community/tesla-car-card/images/tesla_off.png`;

    if (isClimateOn) {
      carImage =
        inTemp < 19
          ? `/local/community/tesla-car-card/images/tesla_preheat.png`
          : `/local/community/tesla-car-card/images/tesla_cool.png`;
    } else if (isCharging) {
      carImage = `/local/community/tesla-car-card/images/tesla_charging.png`;
    }

    return html`
      <ha-card>
        <div class="container">
          <div class="header">
            <div class="battery-main">${battery}%</div>
            <div class="range-sub">
              ${range} km range (Limit: ${chargeLimit}%)
            </div>
          </div>

          <div class="car-wrapper">
            <img class="car-img" src="${carImage}" />
          </div>

          <div class="stats-row">
            <div class="stat-item">
              <span class="label">ODOMETER</span>
              <span class="value">
                ${Math.round(
                  state(`sensor.${p}_odometer`)?.state || 0
                )} km
              </span>
            </div>
            <div class="stat-item">
              <span class="label">INSIDE</span>
              <span class="value">${inTemp}°C</span>
            </div>
          </div>

          <div class="actions">
            <!-- Climate -->
            <button
              class="btn ${isClimateOn
                ? inTemp < 19
                  ? "heat-active"
                  : "cool-active"
                : ""}"
              @click="${() => this._toggleClimate(p, isClimateOn)}"
            >
              <ha-icon icon="mdi:fan"></ha-icon>
              <span>
                ${isClimateOn
                  ? inTemp < 19
                    ? "Heat"
                    : "Cool"
                  : "AC"}
              </span>
            </button>

            <!-- Charging -->
            <button
              class="btn ${isCharging ? "charging-flow" : ""}"
              @mousedown="${this._handleStart}"
              @touchstart="${this._handleStart}"
              @mouseup="${() => this._handleEnd(p, isCharging)}"
              @mouseleave="${() => this._cancelPress()}"
              @touchend="${() => this._handleEnd(p, isCharging)}"
            >
              <ha-icon
                icon="${isCharging
                  ? "mdi:battery-charging-60"
                  : "mdi:ev-station"}"
              ></ha-icon>
              <span>${isCharging ? "Charging" : "Charge"}</span>
            </button>

            <!-- Lock -->
            <button
              class="btn ${isUnlocked ? "unlocked-warn" : ""}"
              @click="${() => this._toggleLock(p, isUnlocked)}"
            >
              <ha-icon
                icon="${isUnlocked ? "mdi:lock-open" : "mdi:lock"}"
              ></ha-icon>
              <span>${isUnlocked ? "Open" : "Locked"}</span>
            </button>
          </div>
        </div>
      </ha-card>
    `;
  }

  /* ---------- LONG PRESS ---------- */

  _handleStart() {
    this._isLongPress = false;
    this._pressTimer = window.setTimeout(() => {
      this._isLongPress = true;
      this._openChargePopup();
    }, 600);
  }

  _handleEnd(prefix, isCharging) {
    clearTimeout(this._pressTimer);
    if (!this._isLongPress) {
      this._toggleCharge(prefix, isCharging);
    }
    this._isLongPress = false;
  }

  _cancelPress() {
    clearTimeout(this._pressTimer);
  }

  /* ---------- POPUP ---------- */

  _openChargePopup() {
    const p = this.config.prefix;

    const limitEntity = this.hass.states[`number.${p}_charge_limit`];
    const ampEntity = this.hass.states[`number.${p}_charging_amps`];

    if (!limitEntity || !ampEntity) return;

    const limit = parseInt(limitEntity.state);
    const amps = parseInt(ampEntity.state);

    const limitMin = limitEntity.attributes.min ?? 50;
    const limitMax = limitEntity.attributes.max ?? 100;

    const ampMin = ampEntity.attributes.min ?? 5;
    const ampMax = ampEntity.attributes.max ?? 32;

    const dialog = document.createElement("div");
    dialog.className = "charge-dialog";

    dialog.innerHTML = `
      <div class="dialog-content">
        <h2>Charging Settings</h2>

        <div class="slider-group">
          <label>Charge Limit: <span id="limitVal">${limit}</span>%</label>
          <input type="range" min="${limitMin}" max="${limitMax}" value="${limit}" id="limitSlider">
        </div>

        <div class="slider-group">
          <label>Charging Amps: <span id="ampVal">${amps}</span> A</label>
          <input type="range" min="${ampMin}" max="${ampMax}" value="${amps}" id="ampSlider">
        </div>

        <div class="dialog-actions">
          <button id="closeBtn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const limitSlider = dialog.querySelector("#limitSlider");
    const limitVal = dialog.querySelector("#limitVal");

    limitSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      limitVal.textContent = val;
      this.hass.callService("number", "set_value", {
        entity_id: `number.${p}_charge_limit`,
        value: val,
      });
    });

    const ampSlider = dialog.querySelector("#ampSlider");
    const ampVal = dialog.querySelector("#ampVal");

    ampSlider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      ampVal.textContent = val;
      this.hass.callService("number", "set_value", {
        entity_id: `number.${p}_charging_amps`,
        value: val,
      });
    });

    dialog.querySelector("#closeBtn").onclick = () => dialog.remove();
    dialog.onclick = (e) => {
      if (e.target === dialog) dialog.remove();
    };
  }

  /* ---------- SERVICES ---------- */

  _toggleCharge(prefix, isCharging) {
    this.hass.callService("switch", isCharging ? "turn_off" : "turn_on", {
      entity_id: `switch.${prefix}_charge`,
    });
  }

  _toggleClimate(prefix, isOn) {
    this.hass.callService("climate", "set_hvac_mode", {
      entity_id: `climate.${prefix}_climate`,
      hvac_mode: isOn ? "off" : "heat_cool",
    });
  }

  _toggleLock(prefix, isUnlocked) {
    this.hass.callService("lock", isUnlocked ? "lock" : "unlock", {
      entity_id: `lock.${prefix}_lock`,
    });
  }

  setConfig(config) {
    this.config = config;
  }

  static get styles() {
    return css`
      .container {
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        color: white;
        background: #1a1a1a;
        border-radius: 15px;
        font-family: sans-serif;
      }

      .battery-main {
        font-size: 4rem;
        font-weight: 900;
        line-height: 1;
      }

      .range-sub {
        color: #888;
        font-size: 0.9rem;
        margin-top: 5px;
      }

      .car-wrapper {
        width: 100%;
        display: flex;
        justify-content: center;
        margin: 15px 0;
      }

      .car-img {
        width: 95%;
        max-width: 450px;
      }

      .stats-row {
        width: 100%;
        display: flex;
        justify-content: space-around;
        margin: 15px 0;
        border-top: 1px solid #333;
        padding-top: 15px;
      }

      .stat-item {
        text-align: center;
      }

      .label {
        font-size: 0.65rem;
        color: #666;
        font-weight: bold;
        text-transform: uppercase;
      }

      .value {
        font-size: 1.1rem;
        font-weight: bold;
      }

      .actions {
        width: 100%;
        display: flex;
        gap: 8px;
      }

      .btn {
        flex: 1;
        padding: 12px 5px;
        border-radius: 10px;
        border: none;
        background: #333;
        color: white;
        font-weight: bold;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
        cursor: pointer;
        transition: 0.3s;
        position: relative;
        overflow: hidden;
      }

      /* Green flowing animation */
      .charging-flow {
        background: linear-gradient(270deg, #1db954, #1ed760, #1db954);
        background-size: 400% 400%;
        animation: flow 2s ease infinite;
      }

      @keyframes flow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      .heat-active { background: #e67e22 !important; }
      .cool-active { background: #3498db !important; }
      .unlocked-warn { background: #cc0000 !important; }

      /* Popup */
      .charge-dialog {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
      }

      .dialog-content {
        background: #1f1f1f;
        padding: 25px;
        border-radius: 16px;
        width: 320px;
        color: white;
        display: flex;
        flex-direction: column;
        gap: 20px;
        animation: fadeIn 0.2s ease;
      }

      .slider-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      input[type="range"] {
        width: 100%;
        accent-color: #1db954;
      }

      .dialog-actions {
        display: flex;
        justify-content: center;
      }

      .dialog-actions button {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        background: #333;
        color: white;
        cursor: pointer;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
  }
}

customElements.define("tesla-car-card", TeslaCarCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "tesla-car-card",
  name: "Tesla Car Card",
  description: "Tesla Card v13 Animated Charging + Dual Slider Popup",
});