/*
	Author: nicdark
	Author URI: http://www.nicdarkthemes.com/
*/


(function($) {
	"use strict";
	
	
	//tooltip
    $( '.nicdark_tooltip' ).tooltip({ 
    	position: {
    		my: "center top",
    		at: "center+0 top-50"
  		}
    });
    //calendar
	$( '.nicdark_calendar' ).datepicker({ });
	//tab
	$('.nicdark_tab').tabs({show: 'fade', hide: 'fade'});
	//toogle
	$( '.nicdark_toogle' ).accordion({
		heightStyle: "content",
		collapsible: true,
		active: false
	}); 
	//accordion
	$( '.nicdark_accordion' ).accordion({
		heightStyle: "content"
	});
	//alerts
	$('.nicdark_alerts').click(function(event){
		$(this).css({
			'display': 'none',
		});
	});
	///////////



	//internal-link
	$('.nicdark_internal_link').click(function(event){

		event.preventDefault();
		var full_url = this.href;
		var parts = full_url.split("#");
		var trgt = parts[1];
		var target_offset = $("#"+trgt).offset();
		var target_top = target_offset.top;
	
		$('html,body').animate({scrollTop:target_top -85}, 900);
	
	});
	///////////


	//nicescrool
	$(".nicdark_nicescrool").niceScroll({
		touchbehavior:true,
		cursoropacitymax:1,
		cursorwidth:0,
		autohidemode:false,
		cursorborder:0
	});
	///////////

		
	//left sidebar OPEN		
	$('.nicdark_left_sidebar_btn_open').click(function(event){
		$('.nicdark_left_sidebar').css({
			'left': '0px',
		});
		$('.nicdark_site, .nicdark_navigation').css({
			'margin-left': '300px',
		});
		$('.nicdark_overlay').addClass('nicdark_overlay_on');
	});
	//left sidebar CLOSE	
	$('.nicdark_left_sidebar_btn_close, .nicdark_overlay').click(function(event){
		$('.nicdark_left_sidebar').css({
			'left': '-300px'
		});
		$('.nicdark_site, .nicdark_navigation').css({
			'margin-left': '0px'
		});
		$('.nicdark_overlay').removeClass('nicdark_overlay_on');
	});
	//right sidebar OPEN		
	$('.nicdark_right_sidebar_btn_open').click(function(event){
		$('.nicdark_right_sidebar').css({
			'right': '0px',
		});
		$('.nicdark_site, .nicdark_navigation').css({
			'margin-left': '-300px',
		});
		$('.nicdark_overlay').addClass('nicdark_overlay_on');
	});
	//right sidebar CLOSE	
	$('.nicdark_right_sidebar_btn_close, .nicdark_overlay').click(function(event){
		$('.nicdark_right_sidebar').css({
			'right': '-300px'
		});
		$('.nicdark_site, .nicdark_navigation').css({
			'margin-left': '0px'
		});
		$('.nicdark_overlay').removeClass('nicdark_overlay_on');
	});
	///////////


})(jQuery);