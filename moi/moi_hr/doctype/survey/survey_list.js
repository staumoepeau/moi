frappe.listview_settings['Survey'] = {
    hide_name_column: true,

    refresh: function (listview) {
        // Set up full-width layout
        $("body").addClass("full-width");
        listview.page.sidebar.hide();
        $(".timeline").hide();
        $(".custom-btn-group").hide();
        $(".like-icon").hide();
        listview.page.wrapper.find(".layout-main-section-wrapper").removeClass("col-md-10");
    }
}