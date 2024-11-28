class LocoTranslate {
    constructor() {
        this.locoConf = window.locoConf;
        this.rtlClass = window.aitwpData.extra_class;
        this.defaultLang = ''; // Initialize defaultLang if needed
        this.initialize();
    }

    initialize() {
        this.onLoad();
    }

    async onLoad() {
        if (this.locoConf && this.locoConf.conf) {
            const { conf } = this.locoConf;
            const allStrings = conf.podata;
            allStrings.shift();
            const { locale, project } = conf;
            this.localAiInitialize = false;

            const projectId = this.generateProjectId(project, locale);
            this.createStringsModal(projectId, 'chrome-ai-translator');
            this.setupEventListeners();
            
            this.translatorObject = await this.ChromeAiTranslator();
            if(this.translatorObject.hasOwnProperty("init")) {
                this.addStringsInModal(allStrings);
            }
            
            this.stringModalEvents();
        }
    }

    async ChromeAiTranslator() {
        return await ChromeAiTranslator.Object(
            {
                mainWrapperSelector: "#chrome-ai-translator-modal",
                btnSelector: "#chrome-ai-translator-modal #chrome_ai_translator_element",
                btnClass: "chrome_ai_translator_btn",
                btnText: "Translate To " + locoConf.conf.locale.label,
                stringSelector: ".chrome-ai-translator-body table tbody tr td.target.translate",
                progressBarSelector: ".aitwp_progress_container",
                sourceLanguage: "en",
                targetLanguage: locoConf.conf.locale.lang,
                targetLanguageLabel: locoConf.conf.locale.label,
                onStartTranslationProcess: this.startTransaltion,
                onComplete: this.completeTranslation,
                onLanguageError: this.languageError,
                onBeforeTranslate: this.beforeTranslate
            }
        );
    }

    showModalBox(widgetId) {
        const modelContainer = jQuery(`#${widgetId}`);
        modelContainer.find(".aitwp_actions > .aitwp_save_strings").prop("disabled", true);
        localStorage.setItem("lang", this.defaultLang);
        // jQuery("#aitwp-dialog").dialog("close");
        modelContainer.fadeIn("slow");
        jQuery(".aitwp_custom_model .aitwp_translate_progress").hide();
    }

    setupEventListeners() {
        if (jQuery("#loco-editor nav").find("#cool-auto-translate-btn").length === 0) {
            this.addAutoTranslationBtn();
        }

        jQuery("#cool-auto-translate-btn").on("click", this.openSettingsModel.bind(this));
        jQuery("button.icon-robot[data-loco='auto']").on("click", this.onAutoTranslateClick.bind(this));
    }

    addStringsInModal(allStrings) {
        const plainStrArr = filterRawObject.init(allStrings, "plain");

        if (plainStrArr.length > 0) {
            this.printStringsInPopup(plainStrArr);
        } else {
            jQuery("#ytWidget").hide();
            jQuery(".notice-container")
                .addClass('notice inline notice-warning')
                .html("There is no plain string available for translations.");
            jQuery(".aitwp_string_container, .choose-lang, .translator-widget, .notice-info, .is-dismissible").hide();
        }
    }

    generateProjectId(project, locale) {
        const { domain } = project || {};
        const { lang, region } = locale;
        return project ? `${domain}-${lang}-${region}` : `temp-${lang}-${region}`;
    }

    onAutoTranslateClick(e) {
        if (e.originalEvent) {
            const checkModal = setInterval(() => {
                const locoModal = jQuery(".loco-modal");
                const locoBatch = locoModal.find("#loco-apis-batch");
                const locoTitle = locoModal.find(".ui-dialog-titlebar .ui-dialog-title");

                if (locoBatch.length && !locoModal.is(":hidden")) {
                    locoModal.removeClass("addtranslations");
                    locoBatch.find("select#auto-api").show();
                    locoBatch.find("a.icon-help, a.icon-group").show();
                    locoBatch.find("#loco-job-progress").show();
                    locoTitle.html("Auto-translate this file");
                    locoBatch.find("button.button-primary span").html("Translate");

                    if (locoBatch.find("select#auto-api option").length === 1) {
                        locoBatch.find(".noapiadded").remove();
                        locoBatch.removeClass("loco-alert").find("form").hide().addClass("loco-alert");
                        locoTitle.html("No translation APIs configured");
                        locoBatch.append(`
                            <div class='noapiadded'>
                                <p>Add automatic translation services in the plugin settings.<br>or<br>Use <strong>Auto Translate</strong> addon button.</p>
                                <nav>
                                    <a href='http://locotranslate.local/wp-admin/admin.php?page=loco-config&amp;action=apis' class='button button-link has-icon icon-cog'>Settings</a>
                                    <a href='https://localise.biz/wordpress/plugin/manual/providers' class='button button-link has-icon icon-help' target='_blank'>Help</a>
                                    <a href='https://localise.biz/wordpress/translation?l=de-DE' class='button button-link has-icon icon-group' target='_blank'>Need a human?</a>
                                </nav>
                            </div>`);
                    }
                    clearInterval(checkModal);
                }
            }, 100);
        }
    }

    addAutoTranslationBtn() {
        const existingBtn = jQuery("#loco-editor nav").find("#cool-auto-translate-btn");
        if (existingBtn.length > 0) {
            existingBtn.remove();
        }
        const locoActions = jQuery("#loco-editor nav").find("#loco-actions");
        const autoTranslateBtn = jQuery('<fieldset><button id="cool-auto-translate-btn" class="button has-icon icon-translate">Auto Translate</button></fieldset>');
        locoActions.append(autoTranslateBtn);
    }

    openSettingsModel() {
        const widgetId = 'chrome-ai-translator-modal';

        this.showModalBox(widgetId);

        if (!this.localAiInitialize && typeof this.translatorObject.init === 'function') {
            this.localAiInitialize = true;
            this.translatorObject.init();
        } else if (typeof this.translatorObject.reInit === 'function') {
            this.translatorObject.reInit();
        }

    }

    stringModalEvents() {
        jQuery(window).on("click", (event) => {
            if (!event.target.closest(".modal-content") && !event.target.closest("#cool-auto-translate-btn") && !event.target.closest(".modal-error-div")) {
                if(this.translatorObject.hasOwnProperty("stopTranslation")) {
                    this.translatorObject.stopTranslation();
                }
                jQuery(".aitwp_custom_model").hide();
            }
        });

        jQuery(".aitwp_custom_model").find(".close").on("click", () => {
            if(this.translatorObject.hasOwnProperty("stopTranslation")) {
                this.translatorObject.stopTranslation();
            }
            jQuery(".aitwp_custom_model").fadeOut("slow");
        });
    }

    encodeHtmlEntity(str) {
        var buf = [];
        for (var i = str.length - 1; i >= 0; i--) {
            buf.unshift(['&#', str[i].charCodeAt(), ';'].join(''));
        }
        return buf.join('');
    }

    printStringsInPopup(jsonObj) {
        let html = '';
        let totalTChars = 0;
        let index = 1;

        if (jsonObj) {
            for (const key in jsonObj) {
                if (jsonObj.hasOwnProperty(key)) {
                    const sourceText = jsonObj[key].source.trim();
                    if (sourceText) {
                        html += `<tr id="${key}"><td>${index}</td><td class="source">${this.encodeHtmlEntity(sourceText)}</td>`;
                        html += `<td class="target translate">${this.encodeHtmlEntity(sourceText)}</td></tr>`;
                        index++;
                        totalTChars += sourceText.length;
                    }
                }
            }
        }

        jQuery(".aitwp_strings_table > tbody.aitwp_strings_body").html(html);
    }

    createStringsModal(projectId, widgetType) {
        const { wrapperCls, headerCls, bodyCls, footerCls, wrapperId } = this.getWidgetClasses(widgetType);
        const modelHTML = `
            <div id="${wrapperId}" class="modal aitwp_custom_model ${wrapperCls}${this.rtlClass ? ` ${this.rtlClass}` : ''}">
                <div class="modal-content">
                <input type="hidden" id="project_id" value="${projectId}"> 
                    ${this.modelHeaderHTML(headerCls)}   
                    ${this.modelBodyHTML(widgetType, bodyCls)}   
                    ${this.modelFooterHTML(footerCls)}
                    </div> 
            </div>`;

        jQuery("body").append(modelHTML);
    }

    getWidgetClasses(widgetType) {
        return {
            wrapperCls: `${widgetType}-container`,
            headerCls: `${widgetType}-header`,
            bodyCls: `${widgetType}-body`,
            footerCls: `${widgetType}-footer`,
            wrapperId: `${widgetType}-modal`
        };
    }

    modelBodyHTML(widgetType, bodyCls) {
        return `
        <div class="modal-body ${bodyCls}">
            <div class="aitwp_translate_progress">
                <div class="aitwp_progress_container">
                    Automatic translation is in progress....<br/>
                    It will take a few minutes, enjoy ☕ coffee in this time!<br/><br/>
                    Please do not leave this window or browser tab while the translation is in progress...
                </div>
            </div>
            ${this.translatorWidget(widgetType)}
            <div class="aitwp_string_container">
                <table class="scrolldown aitwp_strings_table">
                    <thead>
                        <th>S.No</th>
                        <th>Source Text</th>
                        <th>Translation</th>
                    </thead>
                    <tbody class="aitwp_strings_body"></tbody>
                </table>
            </div>
            <div class="notice-container"></div>
        </div>`;
    }

    modelHeaderHTML(headerCls) {
        return `
        <div class="modal-header ${headerCls}">
            <span class="close">&times;</span>
            <h2>Step 1 - Start Automatic Translation Process</h2>
            <div class="aitwp_actions">
                <button class="aitwp_save_strings button button-primary" disabled="true">Merge Translation</button>
            </div>
            <div style="display:none" class="aitwp_stats hidden">
                Wahooo! You have saved your valuable time via auto translating 
                <strong class="totalChars"></strong> characters  using 
                <strong>
                    Chrome AI Translator
                </strong>
            </div>
        </div>
        <div class="notice inline notice-info is-dismissible">
            Plugin will not translate any strings with HTML or special characters because Chrome In Translator currently does not support HTML and special characters translations.
            You can edit translated strings inside Translate Editor after merging the translations. Only special characters (%s, %d) fixed at the time of merging of the translations.
        </div>
        <div class="notice inline notice-info is-dismissible">
            Machine translations are not 100% correct.
            Please verify strings before using on the production website.
        </div>`;
    }

    modelFooterHTML(footerCls) {
        return `
        <div class="modal-footer ${footerCls}">
            <div class="aitwp_actions">
                <button class="aitwp_save_strings button button-primary" disabled="true">Merge Translation</button>
            </div>
            <div style="display:none" class="aitwp_stats">
            Wahooo! You have saved your valuable time via auto translating 
            <strong class="totalChars"></strong> characters  using 
            <strong>
                Chrome AI Translator
            </strong>
        </div>
        </div>`;
    }

    translatorWidget(widgetType) {
        if (widgetType === "chrome-ai-translator") {
            return `
                <div class="translator-widget ${widgetType}">
                    <h3 class="choose-lang">Translate with Chrome Built-in AI <span class="dashicons-before dashicons-translation"></span></h3>
                    <div id="chrome_ai_translator_element"></div>
                </div>`;
        }
        return '';
    }

    startTransaltion() {
        const stringContainer = jQuery("#chrome-ai-translator-modal .modal-content .aitwp_string_container");
        if (stringContainer[0].scrollHeight > 100) {
            jQuery("#chrome-ai-translator-modal .aitwp_translate_progress").fadeIn("slow");
        }
    }

    beforeTranslate(ele) {
        const stringContainer = jQuery("#chrome-ai-translator-modal .modal-content .aitwp_string_container");

        const scrollStringContainer = (position) => {
            stringContainer.scrollTop(position);
        };

        const stringContainerPosition = stringContainer[0].getBoundingClientRect();

        const eleTopPosition = ele.closest("tr").offsetTop;
        const containerHeight = stringContainer.height();

        if (eleTopPosition > (containerHeight + stringContainerPosition.y)) {
            scrollStringContainer(eleTopPosition - containerHeight + ele.offsetHeight);
        }
    }

    completeTranslation(data) {
        jQuery("#chrome-ai-translator-modal .aitwp_stats").show();
        jQuery("#chrome-ai-translator-modal .aitwp_stats .totalChars").html(data.characterCount);
        jQuery("#chrome-ai-translator-modal .aitwp_save_strings").prop("disabled", false);
        setTimeout(() => {
            jQuery("#chrome-ai-translator-modal .aitwp_translate_progress").fadeOut("slow");
        }, 4000);
    }

    languageError(message) {
        const errorDiv = jQuery(`<div class="modal-error-div"><div class="close" role="button" aria-label="Close">&times;</div><div class="modal-error-content"></div></div>`); // Improved structure for better accessibility and readability

        errorDiv.find(".modal-error-content").html(message);

        jQuery("#chrome-ai-translator-modal").find(".modal-content").replaceWith(errorDiv); // Smooth transition for better user experience
    }
}

const filterRawObject = {

    init(rawArray, filterType) {
        return this.filterContent(rawArray, filterType);
    },

    filterContent(rawArray, filterType) {
        return rawArray.filter(item => {
            if (item.source && !item.target) {
                return !this.ValidURL(item.source) && !this.isHTML(item.source) && !this.isSpecialChars(item.source) && !this.isEmoji(item.source) && !item.source.includes('#') || this.isPlacehodersChars(item.source);
            }
            return false;
        });
    },

    ValidURL(str) {
        const pattern = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
        return pattern.test(str);
    },

    isHTML(str) {
        const rgex = /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i;
        return rgex.test(str);
    },

    isSpecialChars(str) {
        const rgex = /[@^{}|<>]/g;
        return rgex.test(str);
    },

    isEmoji(str) {
        const ranges = [
            '(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|[\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|[\ud83c[\ude32-\ude3a]|[\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])'
        ];
        return str.match(ranges.join('|'));
    },

    isPlacehodersChars(str) {
        const rgex = /%s|%d/g;
        return rgex.test(str);
    }
}

// Initialize on load
jQuery(document).ready(() => new LocoTranslate());
