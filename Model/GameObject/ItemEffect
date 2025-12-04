//include('Item')

/*
 * Objet contenant les effets calculés correspondants à un item de type Item
 */
class ItemEffect {
	string name
	Item item
	integer type
	real min
	real max
	real avg
	real avgmax
	real avgmin
	integer duration
	integer targets
	integer modifiers
	//TargetType targetType
	boolean stackable = false
	boolean multiplyByTarget = false
	boolean modifCaster = false
	boolean irreductible = false
	boolean notReplaceable = false
	
	constructor(Array<integer|real> effect, Item item, integer id){
		this.name = item.name+'-'+id
		this.item = item
		this.type = effect[0] as integer
		this.min = effect[1] as real
		this.max = effect[2] as real
		this.avg = (effect[1]+effect[2])/2
		this.avgmax = (effect[1]+effect[2]*3)/4
		this.avgmin = (effect[1]*3+effect[2])/4
		this.duration = effect[3] as integer == 0 ? 1 : effect[3] as integer
		this.targets = effect[4] as integer
		this.modifiers = effect[5] as integer
		// désigne le type de cible intéressante pour cet effet
		//this.targetType = TargetType(this)
		if(this.modifiers & EFFECT_MODIFIER_STACKABLE) this.stackable = true 
		if(this.modifiers & EFFECT_MODIFIER_MULTIPLIED_BY_TARGETS) this.multiplyByTarget = true
		if(this.modifiers & EFFECT_MODIFIER_ON_CASTER) this.modifCaster = true
		if(this.modifiers & EFFECT_MODIFIER_IRREDUCTIBLE) this.irreductible = true
		if(this.modifiers & EFFECT_MODIFIER_NOT_REPLACEABLE) this.notReplaceable = true
	}
	
	/*
	 * Format chaîne de caracteres utilisée pour des tests / debugs.
	 */
	string string() {
		return "<ItemEffect "+this.name+">"
	}
}