<template>
	<div id="categories">
    	<div class="card">
    		<div class="card-content">
				<div class="center-align side-header">{{ langTranslation["Categories"] }}</div>
	        	<ul class="collection">
					<a class="collection-item center-align" :class="{ 'active': isActive('') }" href="./?/">{{ langTranslation["All"] }}</a>
	        		<a class="collection-item center-align" v-for="category in categories" :class="{ 'active': isActive(category.slug) }" :href="'./?/category/' + category.slug">{{ langTranslation[category.name] }}</a>
	        	</ul>
				<div class="center-align side-header">{{ langTranslation["Search Other Zites"] }}</div>
				<ul class="collection">
					<a class="collection-item center-align" :class="{ 'active': false }" :href="'./?/zite/zeroup'" v-on:click.prevent="goto('zite/zeroup');">ZeroUp</a>
					<a class="collection-item center-align" :class="{ 'active': false }" :href="'./?/zite/zerosites'" v-on:click.prevent="goto('zite/zerosites');">ZeroSites</a>
					<a class="collection-item center-align" :class="{ 'active': false }" :href="'./?/zite/zerolist'" v-on:click.prevent="goto('zite/zerolist');">0List</a>
					<a class="collection-item center-align" :class="{ 'active': false }" :href="'./?/zite/zerotalk'" v-on:click.prevent="goto('zite/zerotalk');">ZeroTalk</a>
					<a class="collection-item center-align" :class="{ 'active': false }" :href="'./?/zite/kiwipedia'" v-on:click.prevent="goto('zite/kiwipedia');">Kiwipedia</a>
					<a class="collection-item center-align" :class="{ 'active': false }" :href="'./?/zite/zerome'" v-on:click.prevent="goto('zite/zerome');">ZeroMe</a>
				</ul>
	        	<div class="center-align">
	        		<a href="/Mail.ZeroNetwork.bit/?to=krixano">Request New Category or Claim Ownership of zite: krixano@zeroid.bit</a> <!-- TODO -->
	        	</div>
	        </div>
        </div>
	</div>
</template>

<style>
	.collection .collection-item {
		padding-top: 7px;
		padding-bottom: 7px;
	}
	.side-header {
		font-weight: 400;
	}
</style>

<script>
	var Router = require("../libs/router.js");

	module.exports = {
		props: ["categories", "langTranslation"],
		name: "categories",
		methods: {
			goto: function(to) {
				Router.navigate(to);
			},
			isActive: function(slug) {
				if (slug == "") return Router.currentRoute == "";
				return Router.currentParams['categoryslug'] == slug;
			}
		}
	};
</script>