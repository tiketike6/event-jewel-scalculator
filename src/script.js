/* eslint-disable max-depth */
/* eslint-disable max-statements */
(function () {
    // dayjsのロケール設定
    dayjs.locale('ja');

    const recoveryItems = {
        _drink100: 100,
        _drink50: 50,
        _drink30: 30,
        _drink20: 20,
        _drink10: 10,
        _drinkMax: 0,
        _other100: 100,
        _otherMax: 0,
    };

    // 入力値の取得
    function getFormValue() {
        const formValue = {};
        const errors = [];

        function validDateTime(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!dayjs(inputValue).isValid()) {
                errors.push({
                    field: field,
                    message: '日時の入力例は「2017-06-29T15:00」です。',
                });
            } else {
                formValue[field] = inputValue;
                formValue[`${field}Unix`] = dayjs(inputValue).unix();
            }
        }
        validDateTime('datetimeStart');
        validDateTime('datetimeEnd');

        formValue.endOfTodayUnix = dayjs().endOf('d').unix();
        if (formValue.endOfTodayUnix < formValue.datetimeStartUnix) {
            formValue.endOfTodayUnix = formValue.datetimeStartUnix;
        }
        if (formValue.endOfTodayUnix > formValue.datetimeEndUnix) {
            formValue.endOfTodayUnix = formValue.datetimeEndUnix;
        }

        formValue.nowUnix = dayjs().endOf('m').unix();
        if (formValue.nowUnix < formValue.datetimeStartUnix) {
            formValue.nowUnix = formValue.datetimeStartUnix;
            formValue.isFuture = true;
        }
        if (formValue.nowUnix > formValue.datetimeEndUnix) {
            formValue.nowUnix = formValue.datetimeEndUnix;
        }

        function validNumber(field) {
            const inputValue = $(`#${field}`).val();
            if (!inputValue) {
                errors.push({
                    field: field,
                    message: '必須です。',
                });
            } else if (!Number.isSafeInteger(Number(inputValue))) {
                errors.push({
                    field: field,
                    message: '有効な値ではありません。',
                });
            } else {
                formValue[field] = Number(inputValue);
            }
        }
        validNumber('consumedStamina');
        validNumber('stamina');
        validNumber('maxStamina');
        if (formValue.maxStamina <= 1) {
            errors.push({
                field: 'maxStamina',
                message: '1以上を入力してください。',
            });
        }
        recoveryItems._drinkMax = formValue.maxStamina;
        recoveryItems._otherMax = formValue.maxStamina;
        Object.keys(recoveryItems).forEach((item) => {
            validNumber(`possession${item}`);
            validNumber(`dailyEarn${item}`);
        });

        formValue.isAutoSave = $('#autoSave').prop('checked');

        $('.error').remove();
        if (errors.length) {
            errors.forEach((error) => {
                $(`#${error.field}`).after(`<span class="error">${error.message}</span>`);
            });
            return null;
        }
        return formValue;
    }

    // 自然回復日時・要回復元気の計算
    function calcRecovery(formValue) {
        // 自然回復日時の計算
        const naturalRecoveryUnix = dayjs
            .unix(formValue.nowUnix)
            .add((formValue.consumedStamina - formValue.stamina) * 5, 'm')
            .unix();
        $('#naturalRecoveryAt').text(dayjs.unix(naturalRecoveryUnix).format('M/D H:mm'));

        // 要回復元気の計算
        let requiredRecoveryStamina = 0;
        if (naturalRecoveryUnix > formValue.datetimeEndUnix) {
            requiredRecoveryStamina = Math.ceil((naturalRecoveryUnix - formValue.datetimeEndUnix) / 60 / 5);
        }
        $('#requiredRecoveryStamina').text(requiredRecoveryStamina);
        formValue.requiredRecoveryStamina = requiredRecoveryStamina;

        // 開催期限をオーバーする場合、赤文字
        if (naturalRecoveryUnix > formValue.datetimeEndUnix) {
            $('#naturalRecoveryAt').addClass('danger');
        } else {
            $('#naturalRecoveryAt').removeClass('danger');
        }
    }

    // デイリー獲得数を考慮
    function calcDailyEarn(formValue) {
        Object.keys(recoveryItems).forEach((item) => {
            const dailyEarn = formValue[`dailyEarn${item}`];
            let sumDailyEarn = dayjs.unix(formValue.datetimeEndUnix).endOf('d').diff(dayjs.unix(formValue.nowUnix), 'd') * dailyEarn;
            if (formValue.isFuture) {
                sumDailyEarn += dailyEarn;
            }
            formValue[`sumDailyEarn${item}`] = sumDailyEarn;
        });
    }

    // 回復アイテム消費数・消費ジュエルの計算
    function calcConsume(formValue) {
        // 回復アイテム消費数の最適化
        function calcConsumedRecoveryItems(using, requiredRecovery) {
            const consumed = {};
            const bestConsumed = {};
            Object.keys(recoveryItems).forEach((item) => {
                consumed[item] = 0;
                bestConsumed[item] = formValue[`${using}${item}`];
            });
            let minRecoveredStamina = Infinity;

            // 消費数の最大値を取得
            function calcMaxConsumedRecoveryItems(targetItem) {
                let required = requiredRecovery;
                let isSkip = false;
                Object.keys(recoveryItems).forEach((item) => {
                    if (item === targetItem) isSkip = true;
                    if (isSkip) return;
                    required -= recoveryItems[item] * consumed[item];
                });
                if (required < 0) required = 0;
                if (required < formValue[`${using}${targetItem}`] * recoveryItems[targetItem]) {
                    return Math.ceil(required / recoveryItems[targetItem]);
                }
                return formValue[`${using}${targetItem}`];
            }

            for (consumed._drink100 = calcMaxConsumedRecoveryItems('_drink100'); consumed._drink100 >= 0; consumed._drink100--) {
                for (consumed._drink50 = calcMaxConsumedRecoveryItems('_drink50'); consumed._drink50 >= 0; consumed._drink50--) {
                    for (consumed._drink30 = calcMaxConsumedRecoveryItems('_drink30'); consumed._drink30 >= 0; consumed._drink30--) {
                        for (consumed._drink20 = calcMaxConsumedRecoveryItems('_drink20'); consumed._drink20 >= 0; consumed._drink20--) {
                            for (consumed._drink10 = calcMaxConsumedRecoveryItems('_drink10'); consumed._drink10 >= 0; consumed._drink10--) {
                                for (consumed._drinkMax = calcMaxConsumedRecoveryItems('_drinkMax'); consumed._drinkMax >= 0; consumed._drinkMax--) {
                                    for (
                                        consumed._other100 = calcMaxConsumedRecoveryItems('_other100');
                                        consumed._other100 >= 0;
                                        consumed._other100--
                                    ) {
                                        for (
                                            consumed._otherMax = calcMaxConsumedRecoveryItems('_otherMax');
                                            consumed._otherMax >= 0;
                                            consumed._otherMax--
                                        ) {
                                            let recoveredStamina = 0;
                                            Object.keys(recoveryItems).forEach((item) => {
                                                recoveredStamina += recoveryItems[item] * consumed[item];
                                            });
                                            if (recoveredStamina === requiredRecovery) {
                                                // 回復量が消費量と同じなら無駄ゼロ
                                                return consumed;
                                            }
                                            if (recoveredStamina < requiredRecovery) {
                                                // 回復量が消費量未満なら達成不能
                                                continue;
                                            }
                                            if (recoveredStamina < minRecoveredStamina) {
                                                // 回復量が最小なら格納
                                                minRecoveredStamina = recoveredStamina;
                                                Object.keys(recoveryItems).forEach((item) => {
                                                    bestConsumed[item] = consumed[item];
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return bestConsumed;
        }

        // デイリー獲得アイテムの消費数
        let requiredRecoveryStamina = formValue.requiredRecoveryStamina;
        const bestConsumedDailyEarn = calcConsumedRecoveryItems('sumDailyEarn', formValue.requiredRecoveryStamina);
        Object.keys(recoveryItems).forEach((item) => {
            formValue[`consumedDailyEarn${item}`] = bestConsumedDailyEarn[item];
            requiredRecoveryStamina -= recoveryItems[item] * bestConsumedDailyEarn[item];
        });

        // 回復アイテムの消費数
        const bestConsumedPossession = calcConsumedRecoveryItems('possession', requiredRecoveryStamina);
        Object.keys(recoveryItems).forEach((item) => {
            formValue[`consumedPossession${item}`] = bestConsumedPossession[item];
            requiredRecoveryStamina -= recoveryItems[item] * bestConsumedPossession[item];
        });

        // 消費ジュエル
        let consumedJewelForStarlightStage = 0;
        let consumedJewelForTheaterDays = 0;
        if (requiredRecoveryStamina > 0) {
            consumedJewelForStarlightStage = Math.ceil(requiredRecoveryStamina / 10) * Math.floor(500 / formValue.maxStamina);
            consumedJewelForTheaterDays = Math.ceil(requiredRecoveryStamina / formValue.maxStamina) * 50;
        }

        // 表示
        Object.keys(recoveryItems).forEach((item) => {
            $(`#consumed${item}`).text(`${formValue[`consumedPossession${item}`]} 個 + デイリー ${formValue[`consumedDailyEarn${item}`]} 個`);
        });
        $('#consumedJewelForStarlightStage').text(consumedJewelForStarlightStage);
        $('#consumedJewelForTheaterDays').text(consumedJewelForTheaterDays);
    }

    function calculate() {
        const formValue = getFormValue();
        calcRecovery(formValue);
        calcDailyEarn(formValue);
        calcConsume(formValue);
        if (formValue.isAutoSave) {
            save();
        }
    }

    // input要素の変更時
    $('#datetimeStart').change(calculate);
    $('#datetimeEnd').change(calculate);
    $('#consumedStamina').change(calculate);
    $('#stamina').change(calculate);
    $('#maxStamina').change(calculate);
    Object.keys(recoveryItems).forEach((item) => {
        $(`#possession${item}`).change(calculate);
        $(`#dailyEarn${item}`).change(calculate);
    });
    $('#autoSave').change(calculate);
    $('#update').click(calculate);

    // 保存ボタン
    function save() {
        const datetimeSave = dayjs().format('YYYY/M/D H:mm');

        const saveData = {
            datetimeStart: $('#datetimeStart').val(),
            datetimeEnd: $('#datetimeEnd').val(),
            consumedStamina: $('#consumedStamina').val(),
            stamina: $('#stamina').val(),
            maxStamina: $('#maxStamina').val(),
            autoSave: $('#autoSave').prop('checked'),
            datetimeSave: datetimeSave,
        };
        Object.keys(recoveryItems).forEach((item) => {
            saveData[`possession${item}`] = $(`#possession${item}`).val();
            saveData[`dailyEarn${item}`] = $(`#dailyEarn${item}`).val();
        });

        localStorage.setItem(location.href.replace('index.html', '').replace(location.search, ''), JSON.stringify(saveData));

        $('#datetimeSave').text(datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);
    }
    $('#save').click(save);

    // 入力を初期化ボタン
    function defaultInput() {
        $('#datetimeStart').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        $('#datetimeEnd').val(dayjs().format('YYYY-MM-DDTHH:mm'));
        $('#consumedStamina').val(0);
        $('#stamina').val(0);
        $('#maxStamina').val(150);
        Object.keys(recoveryItems).forEach((item) => {
            $(`#possession${item}`).val(0);
            $(`#dailyEarn${item}`).val(0);
        });
        $('#autoSave').prop('checked', false);

        calculate();
    }
    $('#clearInput').click(defaultInput);

    // 保存した値を読込ボタン
    function loadSavedData() {
        const savedString = localStorage.getItem(location.href.replace('index.html', '').replace(location.search, ''));

        if (!savedString) {
            return false;
        }

        const savedData = JSON.parse(savedString);

        $('#datetimeStart').val(savedData.datetimeStart);
        $('#datetimeEnd').val(savedData.datetimeEnd);
        $('#consumedStamina').val(savedData.consumedStamina);
        $('#stamina').val(savedData.stamina);
        $('#maxStamina').val(savedData.maxStamina);
        Object.keys(recoveryItems).forEach((item) => {
            $(`#possession${item}`).val(savedData[`possession${item}`]);
            $(`#dailyEarn${item}`).val(savedData[`dailyEarn${item}`]);
        });
        $('#autoSave').prop('checked', savedData.autoSave);

        calculate();

        $('#datetimeSave').text(savedData.datetimeSave);
        $('#loadSave').prop('disabled', false);
        $('#clearSave').prop('disabled', false);

        return true;
    }
    $('#loadSave').click(loadSavedData);

    // 保存した値を削除ボタン
    $('#clearSave').click(() => {
        localStorage.removeItem(location.href.replace('index.html', '').replace(location.search, ''));

        $('#datetimeSave').text('削除済');
        $('#loadSave').prop('disabled', true);
        $('#clearSave').prop('disabled', true);
    });

    // 画面表示時に保存した値を読込、保存した値がなければ入力の初期化
    if (!loadSavedData()) {
        defaultInput();
    }

    // URLのパラメーターを取得
    const search = location.search.slice(1);
    if (search) {
        const data = {};
        search.split('&').forEach((fieldValueString) => {
            const fieldValue = fieldValueString.split('=');
            data[fieldValue[0]] = fieldValue[1];
        });
        Object.keys(data).forEach((key) => {
            $(`#${key}`).val(data[key]);
        });
        calculate();
    }
})();
