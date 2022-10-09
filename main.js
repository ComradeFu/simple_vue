class Dep
{
    constructor()
    {
        this.subs = []
    }

    add_sub(sub)
    {
        if (this.subs.indexOf(sub) !== -1)
            throw new Error(`duplicate sub.`)
        this.subs.push(sub)
    }

    remove_sub(sub)
    {
        let index = this.subs.indexOf(sub)
        this.subs.splice(index, 1)
    }

    notify(...args)
    {
        for (let sub of this.subs)
        {
            try
            {
                sub.update(...args)
            }
            catch (e)
            {
                console.error(e)
            }
        }
    }
}

class Watcher
{
    constructor(vm, key, callback)
    {

        Window.__watcher = this
        this.callback = callback
        //触发一下get
        key.split(".").reduce((data, key) => data[key], vm.$data)

        Window.__watcher = null
    }

    update(new_val)
    {
        this.callback(new_val)
    }
}

class Vue
{
    constructor(info)
    {
        let { el, data } = info
        this.$data = data
        this.observe(data)
        this.compile(el)
    }

    observe(obj)
    {
        if (!obj || typeof obj !== "object")
            return

        let that = this
        Object.keys(obj).forEach((key) =>
        {
            let val = obj[key]
            //此key的依赖
            let dep = new Dep()
            Object.defineProperty(obj, key, {
                enumerable: true,
                configurable: true,
                get()
                {
                    //利用在 compile 整个结点的时候，get收集一波
                    if (Window.__watcher)
                    {
                        dep.add_sub(Window.__watcher)
                    }
                    return val
                },
                set(new_val)
                {
                    //通知
                    val = new_val
                    dep.notify(new_val)
                }
            })

            that.observe(val)
        })
    }

    compile(el)
    {
        this.$el = document.querySelector(el)
        let fragment = document.createDocumentFragment()
        let child = undefined
        while (child = this.$el.firstChild)
        {
            fragment.append(child)
        }

        this.node_compile(fragment)

        //处理渲染好之后放回去
        this.$el.appendChild(fragment)
    }

    node_compile(node)
    {
        if (node.nodeType == 3)
        {
            const pattern = /\{\{\s*(\S+)\s*\}\}/
            const result_regex = pattern.exec(node.nodeValue)

            //匹配{{ xxx }}
            if (result_regex)
            {
                let key = result_regex[1]
                let val = key.split(".").reduce((data, key) => data[key], this.$data)

                let origin_node_value = node.nodeValue
                node.nodeValue = node.nodeValue.replace(pattern, val)

                //收集
                let watcher = new Watcher(this, key, (new_val) =>
                {
                    node.nodeValue = origin_node_value.replace(pattern, new_val)
                })
            }

            //文本节点
            return
        }

        if (node.nodeType == 1 && node.nodeName == ["INPUT"])
        {
            let bind = node.attributes["v-model"].nodeValue
            let bind_arr = bind.split(".")
            let val = bind_arr.reduce((data, key) => data[key], this.$data)

            node.nodeValue = val

            //同样监听数据变化
            let watcher = new Watcher(this, bind, (new_val) =>
            {
                node.nodeValue = new_val
            })

            let reduce_arr = bind_arr.slice(0, bind_arr.length - 1)
            let tail_key = bind_arr[bind_arr.length - 1]
            node.addEventListener("input", e =>
            {
                let value = e.target.value
                //赋值回

                let obj = reduce_arr.reduce((data, key) => data[key], this.$data)
                obj[tail_key] = value
            })
        }

        node.childNodes.forEach((child_node) => this.node_compile(child_node))
    }
}
