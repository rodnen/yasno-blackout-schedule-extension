import { Utils } from './utils/utils.js';
import { ErrorReporter } from './utils/reporter.js';

import { DOMElements } from './dom/domElements.js';
import { CacheManager } from './managers/cacheManager.js';
import { ThemeManager } from './managers/themeManager.js';
import { NotificationView } from './view/notificationView.js';
import { MessageManager } from './managers/messageManager.js';
import { DialogManager } from './managers/dialogManager.js';
import { VersionManager } from './managers/versionManager.js';
import { DateManager } from './managers/dateManager.js';
import { SelectManager } from './managers/selectManager.js';
import { InputManager } from './managers/inputManager.js';
import { DataManager } from './managers/dataManager.js';
import { RefreshManager } from './managers/refreshManager.js';
import { PopupManager } from './managers/popupManager.js';

// ============================================================================
// ГОЛОВНИЙ ДОДАТОК
// ============================================================================
export class App {
    constructor() {
        this.dom = new DOMElements();
        requestAnimationFrame(() => requestAnimationFrame(() => this.init()));
    }

    async init() {
        const { dom } = this;

        this.cacheManager = new CacheManager();
        await this.cacheManager.load();

        this.themeManager = new ThemeManager(dom);
        this.messageManager = new MessageManager(dom);
        this.dialogManager = new DialogManager(dom, this.messageManager);
        this.versionManager = new VersionManager(this.dialogManager, this.messageManager);
        this.dateManager = new DateManager(dom, () => this.dataManager.loadData());
        this.notificationView = new NotificationView(dom);

        const onSelectionChange = (type) => {
            if (type === 'dsoId') {
                const { dsoId } = this.selectManager.getValues();

                if (Utils.isInvalidValue(dsoId)) this.inputManager.removeInputs();
                else this.inputManager.renderInputs();
            }

            this.dataManager.loadData();
        };

        this.selectManager = new SelectManager(
            dom,
            this.cacheManager,
            onSelectionChange
        );

        this.inputManager = new InputManager(
            dom,
            this.cacheManager,
            async (g) => {
                await this.selectManager.setAndSaveValue('queue', g);
                await this.dataManager.loadData();
            }
        );

        this.dataManager = new DataManager(
            dom,
            this.selectManager,
            this.dateManager
        );

        this.errorReporter = new ErrorReporter({
            endpoint: "https://docs.google.com/forms/d/e/1FAIpQLScSGSLvZoB6t3RG17AS2ueH0vgCaVl5T813QQElPqkIEMXJKQ/formResponse",
            fieldsMap: {
                error: "entry.581983976",
                stack: "entry.1526738214",
                mode: "entry.1382745580",
                userAgent: "entry.1303966238",
                platform: "entry.1541979604",
                language: "entry.804086390",
                screen: "entry.698707174",
                version: "entry.1787521461"
            }
        });

        const onModeChange = async (mode) => {
            await Utils.sendMessage({ action: 'clearTableCache' });
            await Utils.setStorageData({ mode });
            this.selectManager.setMode(mode);
            this.dataManager.loadData();
        }

        this.popupManager = new PopupManager(
            dom,
            this.dialogManager,
            this.themeManager,
            this.errorReporter,
            onModeChange
        );

        this.refreshManager = new RefreshManager(
            dom,
            this.cacheManager,
            this.messageManager,
            async () => {
                await this.dataManager.loadData();
                this.dateManager.updateDateNumbers();
                this.dateManager.updateIndicator();
            }
        );

        this.themeManager.init();
        this.selectManager.init();
        this.popupManager.init();
        await this.notificationView.init();
    }
}