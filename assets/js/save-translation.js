class SaveTranslation{
    constructor(saveBtnSelector){
        this.saveBtnSelector=saveBtnSelector;
        this.init();
    }

    init(){
        jQuery(document).on('click',this.saveBtnSelector,this.onSaveClick.bind(this));
    }

    onSaveClick(ele){
        const translatedObj = [];
        const rpl = {
            '"% s"': '"%s"', '"% d"': '"%d"', '"% S"': '"%s"', '"% D"': '"%d"',
            '% s': ' %s ', '% S': ' %s ', '% d': ' %d ', '% D': ' %d ',
            '٪ s': ' %s ', '٪ S': ' %s ', '٪ d': ' %d ', '٪ D': ' %d ',
            '٪ س': ' %s ', '%S': ' %s ', '%D': ' %d ', '% %': '%%'
        };
        const regex = /(\%\s*\d+\s*\$?\s*[a-z0-9])/gi;

        jQuery(".aitwp_strings_table tbody tr").each( (i,el)=> {
            const source = jQuery(el).find("td.source").text();
            const target = jQuery(el).find("td.target").text();
            const improvedTarget = this.replaceStringPlaceholders(target, rpl).replace(regex, match => match.replace(/\s/g, '').toLowerCase());
            const improvedSource = this.replaceStringPlaceholders(source, rpl).replace(regex, match => match.replace(/\s/g, '').toLowerCase());

            translatedObj.push({ source: improvedSource, target: improvedTarget });
        });

        const projectId = jQuery(ele.target).parents(".aitwp_custom_model").find("#project_id").val();
        this.saveTranslatedStrings(translatedObj, projectId);
        jQuery(".aitwp_custom_model").fadeOut("slow");
        jQuery("html").addClass("merge-translations");
        this.updateLocoModel();
    }

    saveTranslatedStrings = (translatedStrings, projectId) => {
        if (translatedStrings && translatedStrings.length > 0) {
            const batchSize = 2500;
            for (let i = 0; i < translatedStrings.length; i += batchSize) {
                const batch = translatedStrings.slice(i, i + batchSize);
                const part = `-part-${Math.ceil(i / batchSize)}`;
                this.sendBatchRequest(batch, projectId, part);
            }
        }
    };

    sendBatchRequest = (stringData, projectId, part) => {
        const data = {
            action: 'save_all_translations',
            data: JSON.stringify(stringData),
            part,
            'project-id': projectId,
            wpnonce: aitwpData.nonce
        };

        jQuery.post(aitwpData.ajax_url, data, () => {
            jQuery('#loco-editor nav').find('button').each(function () {
                const id = this.getAttribute('data-loco');
                if (id === "auto" && !jQuery(this).hasClass('modal-opened')) {
                    jQuery(this).addClass('modal-opened').trigger("click");
                }
            });
        });
    };

    updateLocoModel = () => {
        const checkModal = setInterval(() => {
            const locoModel = jQuery('.loco-modal');
            const locoModelApisBatch = jQuery('.loco-modal #loco-apis-batch');
            if (locoModel.length && locoModel.attr("style").indexOf("none") <= -1 && locoModel.find('#loco-job-progress').length) {
                jQuery("html").removeClass("merge-translations");
                locoModelApisBatch.find("a.icon-help, a.icon-group, #loco-job-progress").hide();
                locoModelApisBatch.find("select#auto-api").hide();
                const currentState = jQuery("select#auto-api option[value='loco_auto']").prop("selected", "selected");
                locoModelApisBatch.find("select#auto-api").val(currentState.val());
                locoModel.find(".ui-dialog-titlebar .ui-dialog-title").html("Step 2 - Add Translations into Editor and Save");
                locoModelApisBatch.find("button.button-primary span").html("Start Adding Process").on("click", function () {
                    jQuery(this).find('span').html("Adding...");
                });
                locoModel.addClass("addtranslations");
                jQuery('.noapiadded').remove();
                locoModelApisBatch.find("form").show().removeClass("loco-alert");
                clearInterval(checkModal);
            }
        }, 200);
    };

    replaceStringPlaceholders = (...args) => {
        return !!args[0] && {
            2: ()=> {
                for (var i in args[1]) {
                    args[0] = this.replaceStringPlaceholders(args[0], i, args[1][i]);
                }
                return args[0];
            },
            3: ()=> {
                return args[0].replace(RegExp(args[1], 'g'), args[2]);
            },
            0: ()=> {
                return;
            }
        }[args.length]();
    };
}

jQuery(document).ready(function(){
    new SaveTranslation('.aitwp_save_strings');
});