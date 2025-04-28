<template>
  <div>
    <app-nav></app-nav>
    <div class='container'>
      <spinner v-show='isProcessing' message='Processing...'></spinner>
      <div class="row">
        <div class="col-sm-12 text-left">
        <h1>
          TODOs
          <transition name="fade">
            <small v-if="total">({{ total }})</small>
          </transition>
        </h1>
        </div>
      </div>

      <div class='row'>
        <div class='col-sm-12'>
          <div class='form-control-feedback'>
            <span class='text-danger align-middle'>
            {{ errorMessage }}
            </span>
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-sm-10">
          <input type="text"
                class="form-control"
                v-model="newTask"
                @keyup.enter="addTask"
                placeholder="New task"
          >
        </div>
        <div class="col-sm-2 text-right">
          <button type="submit" class="btn btn-primary" @click="addTask" >Add todo</button>
        </div>
      </div>

      <div class="row">
        <transition-group name="fade" tag="ul" class="no-bullet list-group col-sm-12 my-4">
                  <todo-item v-for="(todo, index) in tasks"
                            @remove="removeTask(index)"
                            :todo="todo"
                            :key="index"
                  ></todo-item>
        </transition-group>
      </div>

    </div>
  </div>
</template>

<script>
import AppNav from '@/components/AppNav'
import TodoItem from '@/components/TodoItem'
import Spinner from '@/components/common/Spinner'

const TODOS_API_BASE_URL = 'https://todos-api-production-30d6.up.railway.app';

export default {
  name: 'todos',
  components: {AppNav, TodoItem, Spinner},
  props: {
    tasks: {
      default: function () {
        return []
      }
    }
  },
  data () {
    return {
      isProcessing: false,
      errorMessage: '',
      newTask: ''
    }
  },
  created () {
    this.loadTasks()
  },
  computed: {
    total () {
      return this.tasks.length
    }
  },
  methods: {
    loadTasks () {
      this.isProcessing = true
      this.errorMessage = ''
      // --- CORREGIDO: Paréntesis y .then en el lugar correcto ---
      this.$http.get('https://todos-api-production-30d6.up.railway.app/todos')
        .then(response => {
          this.tasks.splice(0, this.tasks.length); // Vaciar antes de llenar
          for (var i in response.body) {
            this.tasks.push(response.body[i])
          }
          this.isProcessing = false
        }, error => { // <- Asegúrate que el callback de error esté aquí
          this.isProcessing = false
          this.errorMessage = `Error loading tasks: ${error.status} - ${JSON.stringify(error.body)}`;
        }) // <- Cierre del .then()
    }, // <- Coma separadora

    addTask () {
      if (this.newTask) {
        this.isProcessing = true
        this.errorMessage = ''

        var task = {
          content: this.newTask
        }

        // --- CORREGIDO: Quitado el '$' extra dentro de las backticks ---
        // (También podrías usar comillas simples aquí)
        this.$http.post(`https://todos-api-production-30d6.up.railway.app/todos`, task)
          .then(response => {
            this.newTask = ''
            this.isProcessing = false
            if (response.body && response.body.id) {
              this.tasks.push(response.body);
            } else {
              console.warn("API did not return created task with ID. Reloading tasks.");
              this.loadTasks(); // Recarga todo como fallback
            }
          }, error => { // <- Callback de error
            this.isProcessing = false
            this.errorMessage = `Error adding task: ${error.status} - ${JSON.stringify(error.body)}`;
          }) // <- Cierre del .then()
      }
    }, // <- Coma separadora

    removeTask (index) {
      const item = this.tasks[index]
      // Esta comprobación es importante, pero fallará si 'item' no tiene 'id' porque loadTasks falló
      if (!item || typeof item.id === 'undefined') {
        console.error("Cannot remove task: item or item.id is undefined. Item:", item);
        this.errorMessage = "Cannot remove task: Invalid item data. Try refreshing.";
        return;
      }

      this.isProcessing = true
      this.errorMessage = ''

      // La sintaxis aquí estaba bien, pero ahora item.id debería tener un valor si loadTasks funciona
      this.$http.delete(`https://todos-api-production-30d6.up.railway.app/todos/${item.id}`)
        .then(response => {
          this.isProcessing = false
          this.tasks.splice(index, 1)
        }, error => { // <- Callback de error
          this.isProcessing = false
          this.errorMessage = `Error deleting task: ${error.status} - ${JSON.stringify(error.body)}`;
        }) // <- Cierre del .then()
    }
  } // <- Cierre del bloque 'methods'
}
</script>