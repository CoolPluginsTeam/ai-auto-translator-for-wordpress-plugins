class ChromeAiTranslator {
    // Static method to create an instance of ChromeAiTranslator and return extra data
    static Object = (options) => {
        const selfObject = new this(options);
        return selfObject.extraData();
    };

    // Constructor to initialize the translator with options
    constructor(options) {
        this.btnSelector = options.btnSelector || false; // Selector for the button that triggers translation
        this.btnClass = options.btnClass || false; // Class for the button
        this.btnText = options.btnText || `Translate To ${options.targetLanguageLabel}`; // Text for the button
        this.stringSelector = options.stringSelector || false; // Selector for the elements containing strings to translate
        this.progressBarSelector = options.progressBarSelector || false; // Selector for the progress bar element
        this.onStartTranslationProcess = options.onStartTranslationProcess || (() => { }); // Callback for when translation starts
        this.onComplete = options.onComplete || (() => { }); // Callback for when translation completes
        this.onLanguageError = options.onLanguageError || (() => { }); // Callback for language errors
        this.onBeforeTranslate = options.onBeforeTranslate || (() => { }); // Callback for before translation
        this.onAfterTranslate = options.onAfterTranslate || (() => { }); // Callback for after translation
        this.sourceLanguage = options.sourceLanguage || "en"; // Default source language
        this.targetLanguage = options.targetLanguage || "hi"; // Default target language
        this.targetLanguageLabel = options.targetLanguageLabel || "Hindi"; // Label for the target language
    }

    // Method to check language support and return relevant data
    extraData = async () => {
        // Check if the language is supported
        const langSupportedStatus = await ChromeAiTranslator.languageSupportedStatus(this.sourceLanguage, this.targetLanguage, this.targetLanguageLabel); 

        if(langSupportedStatus !== true){
            this.onLanguageError(langSupportedStatus); // Handle language error
            return {}; // Return empty object if language is not supported
        }

        this.defaultLang = this.targetLanguage; // Set default language

        // Return methods for translation control
        return { 
            continueTranslation: this.continueTranslation, 
            stopTranslation: this.stopTranslation, 
            startTranslation: this.startTranslation, 
            reInit: this.reInit, 
            init: this.init 
        };
    }
    
    /**
     * Checks if the specified source and target languages are supported by the Local Translator AI modal.
     * 
     * @param {string} sourceLanguage - The language code for the source language (e.g., "en" for English).
     * @param {string} targetLanguage - The language code for the target language (e.g., "hi" for Hindi).
     * @param {string} targetLanguageLabel - The label for the target language (e.g., "Hindi").
     * @returns {Promise<boolean|jQuery>} - Returns true if the languages are supported, or a jQuery message if not.
     */
    static languageSupportedStatus = async (sourceLanguage, targetLanguage, targetLanguageLabel) => {
        const supportedLanguages = ['en','es', 'ja', 'ar', 'bn', 'de', 'fr', 'hi', 'it', 'ko', 'nl', 'pl', 'pt', 'ru', 'th', 'tr', 'vi', 'zh', 'zh-hant', 'bg', 'cs', 'da', 'el', 'fi', 'hr', 'hu', 'id', 'iw', 'lt', 'no', 'ro', 'sk', 'sl', 'sv', 'uk', 'en-zh'].map(lang => lang.toLowerCase());

        // Check if the translation API is available
        if (!('translation' in self && 'createTranslator' in self.translation)) {
            const message = jQuery(`<span style="color: #ff4646; margin-top: .5rem; display: inline-block;">The Translator AI modal is currently not supported or disabled in your browser. Please enable it. For detailed instructions on how to enable the Translator AI modal in your Chrome browser, <a href="https://developer.chrome.com/docs/ai/translator-api#bypass_language_restrictions_for_local_testing" target="_blank">click here</a>.</span>`);
            jQuery("#chrome-ai-translator_settings_btn");
            return message;
        }

        // Check if the target language is supported
        if (!supportedLanguages.includes(targetLanguage.toLowerCase())) {
            const message = jQuery(`<span style="color: #ff4646; margin-top: .5rem; display: inline-block;">Unfortunately, the <strong>${targetLanguageLabel} (${targetLanguage})</strong> language is currently not supported by the Local Translator AI modal. Please check and read the docs which languages are currently supported by <a href="https://developer.chrome.com/docs/ai/translator-api#bypass_language_restrictions_for_local_testing" target="_blank">clicking here</a>.</span>`);
            jQuery("#chrome-ai-translator_settings_btn");
            return message;
        }

        // Check if translation can be performed
        const status = await translation.canTranslate({
            sourceLanguage: sourceLanguage,
            targetLanguage: targetLanguage,
        });


        // Handle case for language pack after download
        if (status === "after-download") {
            const message = jQuery(`<span style="color: #ff4646; margin-top: .5rem; display: inline-block;">Please install the <strong>${targetLanguageLabel} (${targetLanguage})</strong> language pack to proceed.To install the language pack, visit <strong>chrome://on-device-translation-internals</strong>. For further assistance, refer to the <a href="https://developer.chrome.com/docs/ai/translator-api#bypass_language_restrictions_for_local_testing" target="_blank">documentation</a>.</span>`);
            jQuery("#chrome-ai-translator_settings_btn");
            return message;
        }

        // Handle case for language pack not readily available
        if (status !== 'readily') {
            const message = jQuery(`<span style="color: #ff4646; margin-top: .5rem; display: inline-block;">Please ensure that the <strong>${targetLanguageLabel} (${targetLanguage})</strong> language pack is installed and set as a preferred language in your browser. To install the language pack, visit <strong>chrome://on-device-translation-internals</strong>. For further assistance, refer to the <a href="https://developer.chrome.com/docs/ai/translator-api#bypass_language_restrictions_for_local_testing" target="_blank">documentation</a>.</span>`);
            return message;
        }

        return true;
    }

    // Method to initialize the translation process
    init = async () => {
        this.appendBtn();
        this.translationStart = false; // Flag to indicate if translation has started
        this.completedTranslateIndex = 0; // Index of the last completed translation
        this.completedCharacterCount = 0; // Count of characters translated
        this.translateBtnEvents(); // Set up button events
        if(this.progressBarSelector) {
            this.addProgressBar(); // Add progress bar to the UI
        }
    };

    /**
     * Appends a translation button to the specified button selector.
     * The button is styled with primary button classes and includes
     * any additional classes specified in `this.btnClass`.
     */
    appendBtn = () => {
        this.translateBtn = jQuery(`<button class="button button-primary${this.btnClass ? ' ' + this.btnClass : ''}">${this.btnText}</button>`);
        jQuery(this.btnSelector).append(this.translateBtn);
    }

    // Method to set up button events for translation
    translateBtnEvents = (e) => {
        if (!this.btnSelector || jQuery(this.btnSelector).length === 0) return this.onLanguageError("The button selector is missing. Please provide a valid selector for the button.");
        if (!this.stringSelector || jQuery(this.stringSelector).length === 0) return this.onLanguageError("The string selector is missing. Please provide a valid selector for the strings to be translated.");

        this.translateStatus = true; // Set translation status to true
        this.translateBtn.off("click"); // Clear previous click handlers
        this.translateBtn.prop("disabled", false); // Enable the button

        // Set up click event for starting translation
        if (!this.translationStart) {
            this.translateBtn.on("click", this.startTranslationProcess);
        } else if (this.translateStringEle.length > (this.completedTranslateIndex + 1)) {
            this.translateBtn.on("click", () => {
                this.onStartTranslationProcess(); // Call the start translation callback
                this.stringTranslation(this.completedTranslateIndex + 1); // Start translating the next string
            });
        } else {
            this.onComplete({translatedStringsCount: this.completedCharacterCount}); // Call the complete callback
            this.translateBtn.prop("disabled", true); // Disable the button
        }
    };

    // Method to start the translation process
    startTranslationProcess = async () => {
        this.onStartTranslationProcess(); // Call the start translation callback
        const langCode = this.defaultLang; // Get the default language code

        this.translationStart = true; // Set translation start flag
        this.translateStringEle = jQuery(this.stringSelector); // Get the elements to translate

        // Calculate total character count for progress tracking
        this.totalStringCount = Array.from(this.translateStringEle).map(ele => ele.innerText.length).reduce((a, b) => a + b, 0);

        // Create a translator instance
        this.translator = await self.translation.createTranslator({
            sourceLanguage: 'en',
            targetLanguage: langCode,
        });

        // Start translating if there are strings to translate
        if (this.translateStringEle.length > 0) {
            await this.stringTranslation(this.completedTranslateIndex);
        }
    };

    // Method to translate a specific string at the given index
    stringTranslation = async (index) => {
        if (!this.translateStatus) return; // Exit if translation is stopped
        const ele = this.translateStringEle[index]; // Get the element to translate
        this.onBeforeTranslate(ele); // Call the before translation callback
        const orignalText = ele.innerText;
        let originalString = [];

        if(ele.childNodes.length > 0 && !ele.querySelector('.notranslate')){
            ele.childNodes.forEach(child => {
                if(child.nodeType === 3 && child.nodeValue.trim() !== ''){
                    originalString.push(child);
                }
            });
        }else if(ele.querySelector('.notranslate')){
           ele.childNodes.forEach(child => {
            if(child.nodeType === 3 && child.nodeValue.trim() !== ''){
                originalString.push(child);
                }
            });
        }

        if(originalString.length > 0){
            await this.stringTranslationBatch(originalString, 0);
        }

        this.completedCharacterCount += orignalText.length; // Update character count
        this.completedTranslateIndex = index; // Update completed index
        if(this.progressBarSelector) {
            this.updateProgressBar(); // Update the progress bar
        }
        this.onAfterTranslate(ele); // Call the after translation callback

        // Continue translating the next string if available
        if (this.translateStringEle.length > index + 1) {
            await this.stringTranslation(this.completedTranslateIndex + 1);
        }

        // If all strings are translated, complete the process
        if (index === this.translateStringEle.length - 1) {
            this.translateBtn.prop("disabled", true); // Disable the button
            this.onComplete({characterCount: this.completedCharacterCount}); // Call the complete callback
            jQuery(this.progressBarSelector).find(".chrome-ai-translator-strings-count").show().find(".totalChars").text(this.completedCharacterCount);
        }
    };

    stringTranslationBatch = async (originalString, index) => {
        const translatedString = await this.translator.translate(originalString[index].nodeValue); // Translate the string

        if (translatedString && '' !== translatedString) {
            originalString[index].nodeValue = translatedString; // Set the translated string
        }

        if(index < originalString.length - 1){
            await this.stringTranslationBatch(originalString, index + 1);
        }

        return true;
    }

    // Method to add a progress bar to the UI
    addProgressBar = () => {
        if (!document.querySelector("#chrome-ai-translator-modal .chrome-ai-translator_progress_bar")) {
            const progressBar = jQuery(`
                <div class="chrome-ai-translator_progress_bar" style="background-color: #f3f3f3;border-radius: 10px;overflow: hidden;margin: 1.5rem auto; width: 50%;">
                <div class="chrome-ai-translator_progress" style="overflow: hidden;transition: width .5s ease-in-out; border-radius: 10px;text-align: center;width: 0%;height: 20px;box-sizing: border-box;background-color: #4caf50; color: #fff; font-weight: 600;"></div>
                </div>
                <div style="display:none; color: white;" class="chrome-ai-translator-strings-count hidden">
                    Wahooo! You have saved your valuable time via auto translating 
                    <strong class="totalChars">0</strong> characters using 
                    <strong>
                        Chrome AI Translator
                    </strong>
                </div>
            `);
            jQuery(this.progressBarSelector).append(progressBar); // Append the progress bar to the specified selector
        }
    };

    // Method to update the progress bar based on translation progress
    updateProgressBar = () => {
        const progress = ((this.completedCharacterCount / this.totalStringCount) * 1000) / 10; // Calculate progress percentage
        let decimalValue = progress.toString().split('.')[1] || ''; // Get decimal part of the progress
        decimalValue = decimalValue.length > 0 && decimalValue[0] !== '0' ? decimalValue[0] : ''; // Format decimal value
        const formattedProgress = parseInt(progress) + `${decimalValue !== '' ? '.' + decimalValue : ''}`; // Format progress for display
        jQuery(".chrome-ai-translator_progress").css({ "width": `${formattedProgress}%` }).text(`${formattedProgress}%`); // Update progress bar width and text
    };

    // Method to stop the translation process
    stopTranslation = () => {
        this.translateStatus = false; // Set translation status to false
    }

    // Method to reinitialize button events
    reInit = () => {
        this.translateBtnEvents(); // Re-setup button events
    }

    // Method to start translation from the current index
    startTranslation = () => {
        this.translateStatus = true; // Set translation status to true
        this.startTranslationProcess(this.completedTranslateIndex + 1); // Start translation process
    }
}

/*
 * Example Usage of the ChromeAiTranslator.init method.
 * This method initializes the Chrome AI Translator with a comprehensive set of configuration options to facilitate the translation process.
 * 
 * Configuration Options:
 * 
 * - mainWrapperSelector: A CSS selector for the main wrapper element that encapsulates all translation-related elements.
 * - btnSelector: A CSS selector for the button that initiates the translation process.
 * - btnClass: A custom class for styling the translation button.
 * - btnText: The text displayed on the translation button.
 * - stringSelector: A CSS selector for the elements that contain the strings intended for translation.
 * - progressBarSelector: A CSS selector for the progress bar element that visually represents the translation progress.
 * - sourceLanguage: The language code representing the source language (e.g., "es" for Spanish).
 * - targetLanguage: The language code representing the target language (e.g., "fr" for French).
 * - onStartTranslationProcess: A callback function that is executed when the translation process begins.
 * - onBeforeTranslate: A callback function that is executed prior to each individual translation.
 * - onAfterTranslate: A callback function that is executed following each translation.
 * - onComplete: A callback function that is executed upon the completion of the translation process.
 * - onLanguageError: A callback function that is executed when a language-related error occurs.
 */

// Example for checking language support status
// ChromeAiTranslator.languageSupportedStatus("en", "fr", "French");

// const chromeAiTranslatorObject = ChromeAiTranslator.Object(
//     {
//         mainWrapperSelector: ".main-wrapper", // CSS selector for the main wrapper element
//         btnSelector: ".translator-container .translator-button", // CSS selector for the translation button
//         btnClass: "Btn_custom_class", // Custom class for button styling
//         btnText: "Translate To French", // Text displayed on the translation button
//         stringSelector: ".translator-body .translation-item", // CSS selector for translation string elements
//         progressBarSelector: ".translator-progress-bar", // CSS selector for the progress bar
//         sourceLanguage: "es", // Language code for the source language
//         targetLanguage: "fr", // Language code for the target language
//         onStartTranslationProcess: () => { console.log("Translation process started."); }, // Callback for translation start
//         onBeforeTranslate: () => { console.log("Before translation."); }, // Callback before each translation
//         onAfterTranslate: () => { console.log("After translation."); }, // Callback after each translation
//         onComplete: () => { console.log("Translation completed."); }, // Callback for completion
//         onLanguageError: () => { console.error("Language error occurred."); } // Callback for language errors
//     }
// );
// chromeAiTranslatorObject.init();