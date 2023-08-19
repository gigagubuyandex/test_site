<script>
    jQuery(document).on('submit','form', function() {
        var m = jQuery(this);
        var formName = m.find('input[name*="d[4]"]').val();
        var mail = m.find('input[name*="email"]').val();
        var fio = m.find('input[name*="name"],input[placeholder*="имя"]').val();
        var phone = m.find('input[name*="phone"],input.phone').val();
        var comment = m.find('textarea[name*="comment"]').val();
        var ct_site_id = '58657';
        var sub = 'Заявка c ' + location.hostname;
        if(!!formName ){sub = formName + ' c ' + location.hostname;}
        var ct_data = {
            fio: fio,
            phoneNumber: phone,
            email: mail,
            comment: comment,
            subject: sub,
            requestUrl: location.href,
            sessionId: window.call_value
        };
        console.log(ct_data);
        if ((!!phone||!!mail)&& window.ct_snd_flag != 1){
        window.ct_snd_flag = 1; setTimeout(function(){ window.ct_snd_flag = 0; }, 20000);
            jQuery.ajax({
                url: 'https://api.calltouch.ru/calls-service/RestAPI/requests/'+ct_site_id+'/register/',  
                dataType: 'json', type: 'POST', data: ct_data, async: false
            });
        }
    });
</script>